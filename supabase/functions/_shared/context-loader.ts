import { record } from "./value.ts";
// Carrega contexto unificado (projeto, avatar, branding, produto, expert) para o Motor de Copy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatOfertasAtivas } from "./oferta-context.ts";

export interface CopyContextInput {
  project_id?: string;
  product_slug?: string;
  lead_id?: string;
  extra?: Record<string, unknown>;
}

export interface CopyContextOutput {
  project: Record<string, unknown> | null;
  product: unknown;
  branding: unknown;
  avatar: unknown;
  expert: unknown;
  lead: Record<string, unknown> | null;
  ofertas_block: string;
  rag_snippets?: string;
}

export async function loadCopyContext(
  input: CopyContextInput,
  serviceRoleKey: string,
  supabaseUrl: string,
): Promise<CopyContextOutput> {
  const sb = createClient(supabaseUrl, serviceRoleKey);

  const out: CopyContextOutput = {
    project: null, product: null, branding: null, avatar: null, expert: null, lead: null, ofertas_block: "",
  };

  if (input.extra?.rag_snippets) {
    const r = input.extra.rag_snippets;
    out.rag_snippets = typeof r === "string"
      ? r
      : Array.isArray(r)
      ? r.map((item: any) => typeof item === "string" ? item : `[Q]: ${item.pergunta}\n[A]: ${item.resposta}`).join("\n\n")
      : undefined;
  }

  if (input.project_id) {
    const { data } = await sb.from("imphq_projects").select("*").eq("id", input.project_id).maybeSingle();
    if (data) {
      out.project = data;
      const d = record(data.data);
      out.branding = d.branding || d.brand || null;
      out.avatar = d.avatar || d.avatars_por_produto || null;
      out.expert = d.expert || null;
      if (input.product_slug && Array.isArray(d.produtos)) {
        out.product = d.produtos.find((p: unknown) => record(p).slug === input.product_slug || record(p).nome === input.product_slug) || null;
      }
      if (Array.isArray(d.produtos)) {
        out.ofertas_block = formatOfertasAtivas(d.produtos, input.product_slug || null);
      }
    }
  }

  if (!out.rag_snippets) {
    const slug = (input.extra?.project_slug as string) || input.product_slug;
    if (slug) {
      const { data: kData } = await sb
        .from("imphq_wa_knowledge")
        .select("pergunta, resposta")
        .eq("project_id", slug)
        .order("score_uso", { ascending: false })
        .limit(5);
      if (kData && kData.length > 0) {
        out.rag_snippets = kData.map((k: { pergunta: string; resposta: string }) => `[Q]: ${k.pergunta}\n[A]: ${k.resposta}`).join("\n\n");
      }
    }
  }

  if (input.lead_id) {
    const { data } = await sb.from("imphq_leads").select("*").eq("id", input.lead_id).maybeSingle();
    if (data) out.lead = data;
  }

  return out;
}

export function contextToSystemAddendum(ctx: CopyContextOutput): string {
  const parts: string[] = [];
  if (ctx.project) parts.push(`PROJETO: ${ctx.project.nome || ctx.project.name || ctx.project.id}`);
  if (ctx.product) parts.push(`PRODUTO: ${JSON.stringify(ctx.product).slice(0, 800)}`);
  if (ctx.branding) parts.push(`BRANDING: ${JSON.stringify(ctx.branding).slice(0, 600)}`);
  if (ctx.avatar) parts.push(`AVATAR: ${JSON.stringify(ctx.avatar).slice(0, 1200)}`);
  if (ctx.expert) parts.push(`EXPERT: ${JSON.stringify(ctx.expert).slice(0, 400)}`);
  if (ctx.lead) parts.push(`LEAD: ${ctx.lead.nome || ctx.lead.email || ctx.lead.phone}`);
  if (ctx.rag_snippets) parts.push(`\n=== CONHECIMENTO RAG DO PRODUTO (ACERVO) ===\n${ctx.rag_snippets}\n=== FIM CONHECIMENTO RAG ===`);
  const base = parts.length ? `\n\n=== CONTEXTO ===\n${parts.join("\n")}\n=== FIM CONTEXTO ===` : "";
  return `${base}${ctx.ofertas_block || ""}`;
}


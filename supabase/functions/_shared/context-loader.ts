import { record } from "./value.ts";
// Carrega contexto unificado (projeto, avatar, branding, produto, expert, documentos imphq_docs e skills imphq_skills) para o Motor de Copy.
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
  docs_block?: string;
  skills_block?: string;
  rag_snippets?: string;
}

export async function loadCopyContext(
  input: CopyContextInput,
  serviceRoleKey: string,
  supabaseUrl: string,
): Promise<CopyContextOutput> {
  const sb = createClient(supabaseUrl, serviceRoleKey);

  const out: CopyContextOutput = {
    project: null,
    product: null,
    branding: null,
    avatar: null,
    expert: null,
    lead: null,
    ofertas_block: "",
    docs_block: "",
    skills_block: "",
  };

  if (input.extra?.rag_snippets) {
    const r = input.extra.rag_snippets;
    out.rag_snippets =
      typeof r === "string"
        ? r
        : Array.isArray(r)
        ? r
            .map((item: unknown) =>
              typeof item === "string" ? item : `[Q]: ${record(item).pergunta}\n[A]: ${record(item).resposta}`
            )
            .join("\n\n")
        : undefined;
  }

  if (input.project_id) {
    const [projRes, docsRes, skillsRes] = await Promise.all([
      sb.from("imphq_projects").select("*").eq("id", input.project_id).maybeSingle(),
      sb
        .from("imphq_docs")
        .select("id,title,category,content,body,project_id")
        .or(`project_id.eq.${input.project_id},project_id.is.null`)
        .limit(8),
      sb
        .from("imphq_skills")
        .select("name,slug,category,description,system_prompt")
        .eq("is_active", true)
        .in("slug", [
          "hook-arsenal",
          "angulos-criativos",
          "mecanismo-unico",
          "dossie-problemas",
          "mapeamento-desejos",
          "vinicius_sugamele",
          "weaponized-credibility",
        ])
        .limit(6),
    ]);

    const data = projRes.data;
    if (data) {
      out.project = data;
      const d = record(data.data);
      out.branding = data.brand_kit || d.branding || d.brand || null;
      out.avatar = data.avatar || d.avatar || d.avatars_por_produto || null;
      out.expert = d.expert || null;
      if (input.product_slug && Array.isArray(d.produtos)) {
        out.product =
          d.produtos.find(
            (p: unknown) => record(p).slug === input.product_slug || record(p).nome === input.product_slug
          ) || null;
      }
      if (Array.isArray(d.produtos)) {
        out.ofertas_block = formatOfertasAtivas(d.produtos, input.product_slug || null);
      }
    }

    if (Array.isArray(docsRes.data) && docsRes.data.length > 0) {
      out.docs_block = docsRes.data
        .slice(0, 5)
        .map((doc: Record<string, unknown>) => {
          const text = String(doc.content || doc.body || "")
            .replace(/\s+/g, " ")
            .slice(0, 320);
          return `- [${doc.category || "doc"}] ${doc.title}: ${text}`;
        })
        .join("\n");
    }

    if (Array.isArray(skillsRes.data) && skillsRes.data.length > 0) {
      out.skills_block = skillsRes.data
        .map((s: Record<string, unknown>) => {
          const snippet = String(s.system_prompt || s.description || "")
            .replace(/\s+/g, " ")
            .slice(0, 260);
          return `- ${s.name} (${s.slug}): ${snippet}`;
        })
        .join("\n");
    }
  }

  if (!out.rag_snippets) {
    const slug = (input.extra?.project_slug as string) || input.product_slug || input.project_id;
    if (slug) {
      const { data: kData } = await sb
        .from("imphq_wa_knowledge")
        .select("pergunta, resposta")
        .eq("project_id", slug)
        .order("score_uso", { ascending: false })
        .limit(5);
      if (kData && kData.length > 0) {
        out.rag_snippets = kData
          .map((k: { pergunta: string; resposta: string }) => `[Q]: ${k.pergunta}\n[A]: ${k.resposta}`)
          .join("\n\n");
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
  if (ctx.avatar) parts.push(`AVATAR PSICOLÓGICO COMPLETO: ${JSON.stringify(ctx.avatar).slice(0, 2200)}`);
  if (ctx.expert) parts.push(`EXPERT: ${JSON.stringify(ctx.expert).slice(0, 400)}`);
  if (ctx.lead) parts.push(`LEAD: ${ctx.lead.nome || ctx.lead.email || ctx.lead.phone}`);
  if (ctx.docs_block) parts.push(`\n=== DOCUMENTOS DO PROJETO (imphq_docs) ===\n${ctx.docs_block}\n=== FIM DOCUMENTOS ===`);
  if (ctx.skills_block) parts.push(`\n=== SKILLS APLICADAS (imphq_skills) ===\n${ctx.skills_block}\n=== FIM SKILLS ===`);
  if (ctx.rag_snippets) parts.push(`\n=== CONHECIMENTO RAG DO PRODUTO (ACERVO) ===\n${ctx.rag_snippets}\n=== FIM CONHECIMENTO RAG ===`);
  const base = parts.length ? `\n\n=== CONTEXTO ===\n${parts.join("\n")}\n=== FIM CONTEXTO ===` : "";
  return `${base}${ctx.ofertas_block || ""}`;
}

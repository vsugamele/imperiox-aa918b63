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
  project: any | null;
  product: any | null;
  branding: any | null;
  avatar: any | null;
  expert: any | null;
  lead: any | null;
  ofertas_block: string;
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

  if (input.project_id) {
    const { data } = await sb.from("imphq_projects").select("*").eq("id", input.project_id).maybeSingle();
    if (data) {
      out.project = data;
      const d = (data as any).data || {};
      out.branding = d.branding || d.brand || null;
      out.avatar = d.avatar || d.avatars_por_produto || null;
      out.expert = d.expert || null;
      if (input.product_slug && Array.isArray(d.produtos)) {
        out.product = d.produtos.find((p: any) => p.slug === input.product_slug || p.nome === input.product_slug) || null;
      }
      if (Array.isArray(d.produtos)) {
        out.ofertas_block = formatOfertasAtivas(d.produtos, input.product_slug || null);
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
  const base = parts.length ? `\n\n=== CONTEXTO ===\n${parts.join("\n")}\n=== FIM CONTEXTO ===` : "";
  return `${base}${ctx.ofertas_block || ""}`;
}


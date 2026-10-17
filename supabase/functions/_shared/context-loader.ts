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

  const [projRes, docsRes, skillsRes, ragChunksRes, swipesRes] = await Promise.all([
    input.project_id
      ? sb.from("imphq_projects").select("*").eq("id", input.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from("imphq_docs")
      .select("id,title,cat,content,body,project_id")
      .or(input.project_id ? `project_id.eq.${input.project_id},project_id.is.null` : "project_id.is.null")
      .limit(12),
    sb
      .from("imphq_skills")
      .select("nome,slug,categoria,descricao,system_prompt")
      .in("status", ["ativo", "Ativo", "Ativa"])
      .in("slug", [
        "planejar-e-conduzir-pesquisa-vsl",
        "encontrar-qualificar-campanhas",
        "extrair-informacoes-vsl",
        "extrair-informacoes-anuncios",
        "pesquisar-organico-youtube",
        "pesquisar-e-consolidar-avatar",
        "escrever-anuncios",
        "mecanismo",
        "conceito-correlacao",
        "nome-chiclete",
        "briefing-vsl",
        "escrita-marketing-thesis",
        "escrita-vsl",
        "derick-lead-vsl",
        "lead-vsl",
        "derick-big-offer-vsl",
        "big-offer-vsl",
        "derick-close-vsl",
        "close-vsl",
        "revisao-vsl",
        "derick-revisao-vsl",
        "escrever-native-ads",
        "escrever-nsl",
        "analise-criativos-escalados",
        "roteiros-virais-comment-to-dm",
        "briefing-gestor-trafego",
        "rebel-copy",
        "devastador-v4",
        "escavador-desejos",
        "invisible-structure",
        "produto-linfaflow",
        "metodo-hw",
        "dtc-control-khayat",
        "weaponized-credibility",
        "escrita-vinicius-sugamele",
        "vinicius_sugamele",
        "hook-arsenal",
        "angulos-criativos",
        "mecanismo-unico",
      ])
      .limit(28),
    sb
      .from("imphq_rag_chunks")
      .select("project_id,source_type,source_id,content")
      .or(input.project_id ? `project_id.eq.${input.project_id},project_id.is.null` : "project_id.is.null")
      .limit(12),
    sb
      .from("imphq_swipes")
      .select("title,formato,mecanismo,raw_text")
      .order("rating", { ascending: false })
      .limit(4),
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
      .slice(0, 8)
      .map((doc: Record<string, unknown>) => {
        const text = String(doc.content || doc.body || "")
          .replace(/\s+/g, " ")
          .slice(0, 420);
        return `- [${doc.cat || "doc"}] ${doc.title}: ${text}`;
      })
      .join("\n");
  }

  if (Array.isArray(skillsRes.data) && skillsRes.data.length > 0) {
    out.skills_block = skillsRes.data
      .map((s: Record<string, unknown>) => {
        const snippet = String(s.system_prompt || s.descricao || "")
          .replace(/\s+/g, " ")
          .slice(0, 380);
        return `- ${s.nome} (${s.slug}): ${snippet}`;
      })
      .join("\n");
  }

  const ragParts: string[] = [];
  if (out.rag_snippets) ragParts.push(out.rag_snippets);

  if (Array.isArray(ragChunksRes.data) && ragChunksRes.data.length > 0) {
    ragParts.push(
      ragChunksRes.data
        .map((c: Record<string, unknown>) => `[RAG ${c.source_type || "acervo"} · ${c.source_id}]: ${c.content}`)
        .join("\n\n")
    );
  }

  if (Array.isArray(swipesRes.data) && swipesRes.data.length > 0) {
    const swipeLines = swipesRes.data
      .filter((sw: Record<string, unknown>) => sw.title || sw.raw_text)
      .map(
        (sw: Record<string, unknown>) =>
          `[SWIPE VENCEDOR · ${sw.formato || "Ad/VSL"}]: ${sw.title} — ${String(sw.raw_text || sw.mecanismo || "").slice(0, 260)}`
      );
    if (swipeLines.length > 0) {
      ragParts.push(swipeLines.join("\n"));
    }
  }

  const slug = (input.extra?.project_slug as string) || input.product_slug || input.project_id;
  if (slug) {
    const { data: kData } = await sb
      .from("imphq_wa_knowledge")
      .select("pergunta, resposta")
      .eq("project_id", slug)
      .order("score_uso", { ascending: false })
      .limit(5);
    if (kData && kData.length > 0) {
      ragParts.push(
        kData
          .map((k: { pergunta: string; resposta: string }) => `[VOC/X1 Q]: ${k.pergunta}\n[A]: ${k.resposta}`)
          .join("\n\n")
      );
    }
  }

  if (ragParts.length > 0) {
    out.rag_snippets = ragParts.join("\n\n");
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
  if (ctx.docs_block) parts.push(`\n=== DOCUMENTOS E DOSSIÊS DO ACERVO (imphq_docs) ===\n${ctx.docs_block}\n=== FIM DOCUMENTOS ===`);
  if (ctx.skills_block) parts.push(`\n=== SKILLS CANÔNICAS APLICADAS (imphq_skills) ===\n${ctx.skills_block}\n=== FIM SKILLS ===`);
  if (ctx.rag_snippets) parts.push(`\n=== ACERVO RAG DE MARKETING, SWIPES & PRODUTO (imphq_rag_chunks + swipes + wa_knowledge) ===\n${ctx.rag_snippets}\n=== FIM ACERVO RAG ===`);
  const base = parts.length ? `\n\n=== CONTEXTO ===\n${parts.join("\n")}\n=== FIM CONTEXTO ===` : "";
  return `${base}${ctx.ofertas_block || ""}`;
}

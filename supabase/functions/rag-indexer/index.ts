// RAG Indexer — extrai textos de briefings, avatares, swipes e skills,
// gera embeddings com cache e faz upsert em imphq_rag_chunks.
//
// USO:
//   POST /rag-indexer { projectId?: string, sources?: ("project"|"swipe"|"skill"|"transcript"|"sale_winning")[] }
//   Sem projectId: indexa skills globais + todos os projetos do usuário.
//   Idempotente via content_hash: só re-embedda quando o texto mudou.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Chunk = {
  project_id: string | null;
  source_type: string;
  source_id: string;
  source_field: string;
  content: string;
  metadata?: Record<string, any>;
};

function chunkText(text: string, maxLen = 800): string[] {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];
  const parts: string[] = [];
  const sentences = clean.split(/(?<=[.!?])\s+/);
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).length > maxLen) {
      if (cur) parts.push(cur);
      cur = s;
    } else {
      cur = cur ? cur + " " + s : s;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

function extractFromProject(p: any): Chunk[] {
  const out: Chunk[] = [];
  const data = p.data || {};
  const fields: Array<[string, any]> = [
    ["nome", p.nome],
    ["nicho", p.nicho || data.nicho],
    ["briefing", data.briefing],
    ["proposta_unica", data.proposta_unica || data.uvp],
    ["promessa", data.promessa],
    ["mecanismo", data.mecanismo],
    ["transformacao", data.transformacao],
    ["objecoes", Array.isArray(data.objecoes) ? data.objecoes.join("\n") : data.objecoes],
  ];

  // Avatar (suporta multi-avatar por produto)
  const avatares: any[] = [];
  if (data.avatar && typeof data.avatar === "object") avatares.push({ produto: "principal", ...data.avatar });
  if (data.avatares_por_produto && typeof data.avatares_por_produto === "object") {
    for (const [prod, av] of Object.entries(data.avatares_por_produto)) {
      avatares.push({ produto: prod, ...(av as any) });
    }
  }
  for (const av of avatares) {
    const lines: string[] = [];
    for (const key of ["dor_principal", "dores", "desejos", "objecoes", "linguagem", "persona", "demografia"]) {
      const v = (av as any)[key];
      if (v) lines.push(`${key}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
    if (lines.length) {
      out.push({
        project_id: p.id,
        source_type: "project",
        source_id: p.id,
        source_field: `avatar:${av.produto || "default"}`,
        content: `Avatar (${av.produto || "principal"}):\n${lines.join("\n")}`,
        metadata: { produto: av.produto },
      });
    }
  }

  // Branding
  if (data.branding && typeof data.branding === "object") {
    const b = data.branding;
    const bLines: string[] = [];
    for (const k of ["tom_de_voz", "personalidade", "do", "dont", "exemplos", "manifesto"]) {
      const v = b[k];
      if (v) bLines.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
    if (bLines.length) {
      out.push({
        project_id: p.id, source_type: "project", source_id: p.id,
        source_field: "branding", content: `Branding:\n${bLines.join("\n")}`,
      });
    }
  }

  for (const [field, val] of fields) {
    if (!val) continue;
    const text = typeof val === "string" ? val : JSON.stringify(val);
    const chunks = chunkText(text, 800);
    chunks.forEach((c, i) => out.push({
      project_id: p.id, source_type: "project", source_id: p.id,
      source_field: chunks.length > 1 ? `${field}:${i}` : field,
      content: `${field}: ${c}`,
    }));
  }
  return out;
}

async function indexChunks(supabase: any, chunks: Chunk[]) {
  let inserted = 0, skipped = 0, failed = 0;
  for (const ch of chunks) {
    try {
      const hash = await sha256(ch.content);
      const { data: existing } = await supabase
        .from("imphq_rag_chunks")
        .select("id, content_hash")
        .eq("source_type", ch.source_type)
        .eq("source_id", ch.source_id)
        .eq("source_field", ch.source_field)
        .maybeSingle();
      if (existing?.content_hash === hash) { skipped++; continue; }

      const emb = await getCachedEmbedding(supabase, ch.content);
      if (!emb) { failed++; continue; }

      const row = {
        project_id: ch.project_id,
        source_type: ch.source_type,
        source_id: ch.source_id,
        source_field: ch.source_field,
        content: ch.content,
        content_hash: hash,
        embedding: emb as any,
        metadata: ch.metadata || {},
        updated_at: new Date().toISOString(),
      };
      if (existing?.id) {
        await supabase.from("imphq_rag_chunks").update(row).eq("id", existing.id);
      } else {
        await supabase.from("imphq_rag_chunks").insert(row);
      }
      inserted++;
    } catch (e: any) {
      console.error("[rag-indexer] chunk failed", ch.source_type, ch.source_field, e?.message);
      failed++;
    }
  }
  return { inserted, skipped, failed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const projectId: string | null = body.projectId || null;
    const sources: string[] = body.sources || ["project", "swipe", "skill", "transcript", "sale_winning"];

    const allChunks: Chunk[] = [];

    if (sources.includes("project")) {
      const q = supabase.from("imphq_projects").select("id, nome, nicho, data");
      const { data: projects } = projectId ? await q.eq("id", projectId) : await q.limit(200);
      for (const p of projects || []) allChunks.push(...extractFromProject(p));
    }

    if (sources.includes("swipe")) {
      const q = supabase.from("imphq_swipes")
        .select("id, project_id, titulo, copy, hook, formato, categoria, angulo")
        .limit(500);
      const { data: swipes } = projectId ? await q.eq("project_id", projectId) : await q;
      for (const s of swipes || []) {
        const txt = [s.titulo, s.hook, s.copy, s.angulo].filter(Boolean).join("\n");
        if (!txt.trim()) continue;
        allChunks.push({
          project_id: s.project_id || null,
          source_type: "swipe",
          source_id: s.id,
          source_field: "main",
          content: `Swipe (${s.formato || "—"}, ${s.categoria || "—"}):\n${txt}`,
          metadata: { formato: s.formato, categoria: s.categoria },
        });
      }
    }

    if (sources.includes("skill")) {
      const { data: skills } = await supabase
        .from("imphq_skills")
        .select("id, nome, slug, categoria, descricao, system_prompt")
        .eq("status", "Ativa")
        .limit(100);
      for (const sk of skills || []) {
        const txt = [sk.descricao, sk.system_prompt].filter(Boolean).join("\n");
        if (!txt.trim()) continue;
        allChunks.push({
          project_id: null,
          source_type: "skill",
          source_id: sk.id,
          source_field: "main",
          content: `Skill "${sk.nome}" (${sk.categoria || "—"}):\n${txt.slice(0, 1500)}`,
          metadata: { slug: sk.slug, categoria: sk.categoria },
        });
      }
    }

    // NEW: transcripts (aulas/vídeos ingeridos via transcript-ingest) — espelha
    // imphq_wa_knowledge[source LIKE 'transcript:%'] em imphq_rag_chunks para
    // que mentes/copilot encontrem trechos de aulas no RAG geral.
    if (sources.includes("transcript")) {
      const q = supabase
        .from("imphq_wa_knowledge")
        .select("id, project_id, pergunta, resposta, source")
        .like("source", "transcript:%")
        .limit(2000);
      const { data: trs } = projectId ? await q.eq("project_id", projectId) : await q;
      for (const t of trs || []) {
        const txt = (t.resposta || "").trim();
        if (!txt) continue;
        allChunks.push({
          project_id: t.project_id || null,
          source_type: "transcript",
          source_id: t.id,
          source_field: t.source || "transcript",
          content: `📚 ${t.pergunta || "Aula"}:\n${txt}`,
          metadata: { aula: t.pergunta, tag: t.source },
        });
      }
    }

    // NEW: padrões de vendas vencedoras (item: aprendizado de vendas fechadas)
    if (sources.includes("sale_winning")) {
      const q = supabase
        .from("imphq_wa_knowledge")
        .select("id, project_id, pergunta, resposta, source")
        .in("source", ["sale_winning", "sale_winning_full"])
        .limit(1000);
      const { data: sws } = projectId ? await q.eq("project_id", projectId) : await q;
      for (const s of sws || []) {
        const txt = (s.resposta || "").trim();
        if (!txt) continue;
        allChunks.push({
          project_id: s.project_id || null,
          source_type: "sale_winning",
          source_id: s.id,
          source_field: s.source || "sale_winning",
          content: `💰 Padrão de venda fechada — ${s.pergunta?.slice(0, 80) || ""}\n${txt}`,
          metadata: { kind: s.source },
        });
      }
    }

    const result = await indexChunks(supabase, allChunks);
    return new Response(JSON.stringify({ ok: true, total: allChunks.length, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[rag-indexer] error", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Ingest de arquivos para base de conhecimento do agente.
// Aceita { agent_id, file_path, file_name, text? } — se `text` vier, usa direto;
// senão baixa do bucket `agent-knowledge` e extrai texto (txt/md/csv/json).
// Faz chunking (~1000 chars com overlap 150), gera embeddings via Lovable AI Gateway
// (openai/text-embedding-3-small, 768 dims) e insere em imphq_agent_knowledge.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

async function embed(texts: string[]): Promise<number[][]> {
  if (!LOVABLE_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: texts,
      dimensions: 768,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embedding falhou (${res.status}): ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return (j.data as Array<{ embedding: number[]; index: number }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { agent_id, file_path, file_name, text } = body as {
      agent_id: string; file_path?: string; file_name: string; text?: string;
    };
    if (!agent_id || !file_name) {
      return new Response(JSON.stringify({ error: "agent_id e file_name obrigatórios" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPA_URL, SUPA_SRV);
    let raw = text || "";

    if (!raw && file_path) {
      const { data, error } = await sb.storage.from("agent-knowledge").download(file_path);
      if (error) throw new Error(`Download falhou: ${error.message}`);
      const buf = new Uint8Array(await data.arrayBuffer());
      const lower = file_name.toLowerCase();
      if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".json")) {
        raw = new TextDecoder().decode(buf);
      } else {
        // PDF/DOCX: extração básica via texto legível (heurística — para produção plugar parser)
        raw = new TextDecoder().decode(buf).replace(/[^\x20-\x7E\n\u00C0-\u017F]/g, " ");
      }
    }

    raw = (raw || "").trim();
    if (raw.length < 20) {
      return new Response(JSON.stringify({ error: "Conteúdo vazio ou muito curto" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Remove chunks antigos deste arquivo antes de reinserir
    if (file_path) {
      await sb.from("imphq_agent_knowledge").delete().eq("agent_id", agent_id).eq("source_path", file_path);
    }

    const chunks = chunkText(raw);
    // Batches de 50 para respeitar limite do provider
    const BATCH = 50;
    let inserted = 0;
    for (let b = 0; b < chunks.length; b += BATCH) {
      const slice = chunks.slice(b, b + BATCH);
      const embs = await embed(slice);
      const rows = slice.map((content, i) => ({
        agent_id,
        source_type: "file",
        source_name: file_name,
        source_path: file_path || null,
        chunk_index: b + i,
        content,
        embedding: embs[i] as any,
      }));
      const { error } = await sb.from("imphq_agent_knowledge").insert(rows as any);
      if (error) throw new Error(`Insert falhou: ${error.message}`);
      inserted += rows.length;
    }

    return new Response(JSON.stringify({ ok: true, chunks: inserted }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[agent-ingest-file]", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

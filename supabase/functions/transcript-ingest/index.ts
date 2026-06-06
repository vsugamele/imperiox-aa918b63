// transcript-ingest: Direct text → chunk → embed → imphq_wa_knowledge
// Called by the batch upload PowerShell script for JP Freitas transcripts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 80) chunks.push(chunk);
    start += size - overlap;
  }
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_KEY) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-embedding-001", input: text.slice(0, 2000).trim(), dimensions: 768 }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.data?.[0]?.embedding) return d.data[0].embedding;
      }
    } catch (_) {}
  }

  const OR_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OR_KEY) throw new Error("No embedding provider key available");
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 8000).trim(), dimensions: 768 }),
  });
  if (!res.ok) throw new Error(`OpenRouter embed failed: ${res.status}`);
  const d = await res.json();
  return d.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    // Robustly parse body — avoid issues with large PowerShell-encoded JSON
    const rawBody = await req.text();
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, title, source_tag } = parsed;
    const content: string = parsed.content ?? "";

    console.log(`[transcript-ingest] Received: project=${project_id} title="${title}" content_length=${content.length}`);

    if (!project_id || !content) {
      return new Response(JSON.stringify({ error: "project_id and content are required", received_content_length: content.length }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tag = source_tag || `transcript:${title || "import"}`;

    // Delete old entries for this source tag (idempotent re-import)
    await supa.from("imphq_wa_knowledge").delete().eq("project_id", project_id).eq("source", tag);

    const chunks = chunkText(content);
    console.log(`[transcript-ingest] "${title}" → content_len=${content.length} → ${chunks.length} chunks`);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunkStr = chunks[i];
      try {
        const embedding = await getEmbedding(chunkStr);
        await supa.from("imphq_wa_knowledge").insert({
          project_id,
          pergunta: `${title} — trecho ${i + 1}`,
          resposta: chunkStr,
          embedding,
          source: tag,
          aprovada: true,
        });
        inserted++;
        if (i % 20 === 0) console.log(`[transcript-ingest] Progress: ${i + 1}/${chunks.length}`);
      } catch (e: any) {
        console.warn(`[transcript-ingest] Chunk ${i + 1} failed: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, title, chunks: inserted, total: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[transcript-ingest] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

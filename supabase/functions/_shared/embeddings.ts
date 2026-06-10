// Helper compartilhado de embeddings com cache.
// Antes: cada chamada paga ao Lovable/OpenRouter mesmo se o mesmo texto foi feito ontem.
// Depois: lookup em imphq_embedding_cache por SHA256(text + model + dims).
//
// USO:
//   import { getCachedEmbedding } from "../_shared/embeddings.ts";
//   const emb = await getCachedEmbedding(supabase, "texto da pergunta");
//
// Economia esperada em RAG / detect-gaps / feedback-learn: 60-80%
// (pois leads fazem perguntas similares e operadores aprovam variações próximas).

export const DEFAULT_MODEL = "google/gemini-embedding-001";
export const DEFAULT_DIMENSIONS = 768;

function normalizeForHash(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function callEmbeddingApi(text: string, model: string, dimensions: number): Promise<number[] | null> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_KEY) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: text.slice(0, 2000), dimensions }),
      });
      if (res.ok) {
        const d = await res.json();
        const emb = d?.data?.[0]?.embedding;
        if (emb) return emb;
      } else {
        console.warn(`[embeddings] Lovable error ${res.status}`);
      }
    } catch (e: any) {
      console.warn(`[embeddings] Lovable failed: ${e?.message}`);
    }
  }

  const OR_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OR_KEY) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 8000), dimensions }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d?.data?.[0]?.embedding ?? null;
  } catch (e: any) {
    console.warn(`[embeddings] OpenRouter failed: ${e?.message}`);
    return null;
  }
}

/**
 * Obtém embedding usando cache. Lookup → API call → write-through.
 * @returns embedding array ou null se falhar
 */
export async function getCachedEmbedding(
  supabase: any,
  text: string,
  opts: { model?: string; dimensions?: number; skipCache?: boolean } = {}
): Promise<number[] | null> {
  const model = opts.model || DEFAULT_MODEL;
  const dimensions = opts.dimensions || DEFAULT_DIMENSIONS;
  const normalized = normalizeForHash(text);
  if (!normalized || normalized.length < 2) return null;

  if (!opts.skipCache) {
    try {
      const hash = await sha256Hex(`${normalized}::${model}::${dimensions}`);
      const { data: cached } = await supabase
        .from("imphq_embedding_cache")
        .select("id, embedding, hits")
        .eq("text_hash", hash)
        .eq("model", model)
        .eq("dimensions", dimensions)
        .maybeSingle();

      if (cached?.embedding) {
        // Fire-and-forget atualização de hits/last_used_at
        supabase.from("imphq_embedding_cache")
          .update({ hits: (cached.hits || 0) + 1, last_used_at: new Date().toISOString() })
          .eq("id", cached.id)
          .then(() => {}, () => {});
        return cached.embedding;
      }

      // Cache miss: chama API
      const emb = await callEmbeddingApi(normalized, model, dimensions);
      if (!emb) return null;

      // Write-through (fire-and-forget)
      supabase.from("imphq_embedding_cache").insert({
        text_hash: hash,
        model,
        dimensions,
        embedding: emb,
        text_preview: normalized.slice(0, 200),
        hits: 1,
      }).then(() => {}, (e: any) => console.warn(`[embeddings] cache insert failed: ${e?.message}`));

      return emb;
    } catch (e: any) {
      console.warn(`[embeddings] cache layer error, falling back: ${e?.message}`);
    }
  }

  return callEmbeddingApi(normalized, model, dimensions);
}

/**
 * Versão batch: paraleliza lookup e API calls.
 * Retorna array de embeddings (null em índice se falhou).
 */
export async function getCachedEmbeddingsBatch(
  supabase: any,
  texts: string[],
  opts: { model?: string; dimensions?: number } = {}
): Promise<(number[] | null)[]> {
  return Promise.all(texts.map(t => getCachedEmbedding(supabase, t, opts)));
}

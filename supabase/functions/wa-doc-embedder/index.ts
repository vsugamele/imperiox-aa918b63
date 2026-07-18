import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

// Simple text splitter function
function splitText(text: string, chunkSize = 500, chunkOverlap = 100): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex > text.length) {
      endIndex = text.length;
    }
    chunks.push(text.slice(startIndex, endIndex));
    startIndex += chunkSize - chunkOverlap;
  }
  return chunks;
}

// Strip HTML tags helper
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

// Consistent embedding getter
async function getEmbedding(text: string): Promise<number[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY) {
    console.log(`[embeddings] Generating embedding via Lovable AI Gateway (google/gemini-embedding-001)...`);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-embedding-001",
          input: text.trim(),
          dimensions: 768,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const emb = data?.data?.[0]?.embedding;
        if (emb) return emb;
      }
      console.warn(`[embeddings] Lovable AI Gateway call failed: ${res.status}`);
    } catch (e: any) {
      console.warn(`[embeddings] Lovable AI Gateway error: ${e.message}`);
    }
  }

  // Fallback to OpenRouter
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (OPENROUTER_API_KEY) {
    console.log(`[embeddings] Generating embedding via OpenRouter (openai/text-embedding-3-small)...`);
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: text.trim(),
        dimensions: 768,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const emb = data?.data?.[0]?.embedding;
      if (emb) return emb;
    }
    const errText = await res.text();
    throw new Error(`OpenRouter Embedding failed: ${res.status} - ${errText}`);
  }

  throw new Error("No embedding provider available (both LOVABLE_API_KEY and OPENROUTER_API_KEY are missing or failed)");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, text, doc_id, project_id, active } = body;

    if (action === "get_embedding") {
      if (!text) {
        return new Response(JSON.stringify({ error: "text is required for get_embedding action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[wa-doc-embedder] Generating query embedding for: "${text.substring(0, 50)}..."`);
      const embedding = await getEmbedding(text);

      return new Response(JSON.stringify({ success: true, embedding }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!doc_id || !project_id) {
      return new Response(JSON.stringify({ error: "doc_id and project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up old entries first
    const sourceTag = `doc:${doc_id}`;
    const { error: deleteErr } = await supabase
      .from("imphq_wa_knowledge")
      .delete()
      .eq("source", sourceTag);

    if (deleteErr) {
      console.error("[wa-doc-embedder] Error deleting old chunks:", deleteErr.message);
    }

    // If active === false, we only wanted to delete and deactivate AI training
    if (active === false) {
      return new Response(JSON.stringify({ success: true, message: "IA training deactivated. Old chunks removed." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch document details
    const { data: doc, error: fetchErr } = await supabase
      .from("imphq_docs")
      .select("*")
      .eq("id", doc_id)
      .single();

    if (fetchErr || !doc) {
      throw new Error(`Doc not found: ${fetchErr?.message || ""}`);
    }

    let rawText = doc.content || "";
    const parsedFile = rawText.trim().match(/^\[\[file:(.+?)\|(.+?)\]\]$/);

    if (parsedFile) {
      const fileUrl = parsedFile[1];
      const mimeType = parsedFile[2].toLowerCase();

      console.log(`[wa-doc-embedder] Fetching file from URL: ${fileUrl} (${mimeType})`);

      // Try fetching the text/md/html file
      if (mimeType.includes("text") || mimeType.includes("markdown") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("xml")) {
        const fileRes = await fetch(fileUrl);
        if (fileRes.ok) {
          rawText = await fileRes.text();
          if (mimeType.includes("html")) {
            rawText = stripHtml(rawText);
          }
        } else {
          throw new Error(`Failed to fetch file content from URL. HTTP status: ${fileRes.status}`);
        }
      } else if (mimeType.includes("pdf")) {
        const fileRes = await fetch(fileUrl);
        if (fileRes.ok) {
          const arrayBuffer = await fileRes.arrayBuffer();
          const { getDocumentProxy, extractText } = await import("npm:unpdf");
          const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
          const { text } = await extractText(pdf, { mergePages: true });
          rawText = text || "";
        } else {
          throw new Error(`Failed to fetch PDF file from URL. HTTP status: ${fileRes.status}`);
        }
      } else if (mimeType.includes("wordprocessingml") || mimeType.includes("docx") || mimeType.includes("msword")) {
        const fileRes = await fetch(fileUrl);
        if (fileRes.ok) {
          const arrayBuffer = await fileRes.arrayBuffer();
          const mammoth = await import("npm:mammoth");
          const { value } = await mammoth.extractRawText({ arrayBuffer });
          rawText = value || "";
        } else {
          throw new Error(`Failed to fetch DOCX file from URL. HTTP status: ${fileRes.status}`);
        }
      } else {
        // Binary files that cannot be easily parsed inside Edge Function are skipped
        return new Response(JSON.stringify({
          success: true,
          message: "Files of this type (e.g. images) cannot be parsed directly in real-time. PDF, DOCX or text files are expected."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const cleanText = rawText.trim();
    if (!cleanText) {
      return new Response(JSON.stringify({ success: true, message: "Document has no text content. Skipped." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split text into chunks
    const chunks = splitText(cleanText, 600, 100);
    console.log(`[wa-doc-embedder] Chunked document into ${chunks.length} parts.`);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i].trim();
      if (!chunkText) continue;

      console.log(`[wa-doc-embedder] Embedding chunk ${i + 1}/${chunks.length}...`);
      const embedding = await getEmbedding(chunkText);

      // Insert chunk into knowledge base
      const { error: insErr } = await supabase
        .from("imphq_wa_knowledge")
        .insert({
          project_id,
          pergunta: `${doc.title} - Parte ${i + 1}`,
          resposta: chunkText,
          embedding,
          source: sourceTag,
          aprovada: true,
        });

      if (insErr) {
        throw new Error(`Failed to insert knowledge chunk: ${insErr.message}`);
      }
      inserted++;
    }

    return new Response(JSON.stringify({ success: true, chunks: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[wa-doc-embedder] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

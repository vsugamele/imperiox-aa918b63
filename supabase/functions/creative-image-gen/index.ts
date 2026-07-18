import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function genImage(prompt: string): Promise<string | null> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) {
    console.error("img gen fail", resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { prompt, project_id, title, produto_nome } = await req.json();
    if (!prompt || !project_id) {
      return new Response(JSON.stringify({ error: "prompt e project_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = await genImage(prompt);
    if (!dataUrl) {
      return new Response(JSON.stringify({ error: "Falha na geração de imagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert data URL to blob and upload
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    const mime = m?.[1] || "image/png";
    const b64 = m?.[2] || dataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = mime.split("/")[1].split("+")[0];
    const path = `${project_id}/criativos/${Date.now()}.${ext}`;

    const { error: upErr } = await supa.storage.from("creative-assets").upload(path, bytes, {
      contentType: mime, upsert: false,
    });
    if (upErr) throw upErr;

    const { data: pub } = supa.storage.from("creative-assets").getPublicUrl(path);
    const file_url = pub.publicUrl;

    // Save in content library
    const { data: row, error: insErr } = await supa.from("imphq_content_library").insert({
      project_id,
      title: title || "Criativo gerado por IA",
      file_url,
      file_type: mime,
      thumbnail_url: file_url,
      tags: ["ia", "criativo"],
      content_category: produto_nome || null,
      size_bytes: bytes.byteLength,
    }).select().single();
    if (insErr) console.error("insert library fail", insErr);

    return new Response(JSON.stringify({ file_url, library_id: row?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

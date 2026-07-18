// Gera imagem de preview do prompt via Lovable AI Gateway (Nano Banana)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { prompt, save_to_vault_id } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições. Aguarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione em Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gateway ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    const imageUrl: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) throw new Error("Sem imagem retornada");

    // Upload opcional ao bucket + atualiza thumbnail no cofre
    let publicUrl = imageUrl;
    if (save_to_vault_id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        // imageUrl é data:image/png;base64,...
        const m = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) {
          const mime = m[1];
          const ext = mime.split("/")[1];
          const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
          const path = `${save_to_vault_id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("studio-previews")
            .upload(path, bytes, { contentType: mime, upsert: true });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("studio-previews").getPublicUrl(path);
            publicUrl = pub.publicUrl;
            await supabase
              .from("imphq_prompts_salvos")
              .update({ thumbnail_url: publicUrl })
              .eq("id", save_to_vault_id);
          }
        }
      } catch (e) {
        console.error("upload preview:", e);
      }
    }

    return new Response(JSON.stringify({ image_url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("hyper-prompt-preview:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

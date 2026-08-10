// Upload de mídia fixa do funil X1 para o bucket público `whatsapp-media`.
// Protegido por token compartilhado (X1_SEED_TOKEN) porque roda com service_role.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expected = Deno.env.get("X1_SEED_TOKEN");
    if (!expected) throw new Error("X1_SEED_TOKEN não configurado");
    if (req.headers.get("x-seed-token") !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { path, b64, contentType } = await req.json();
    if (!path || !b64) throw new Error("path e b64 obrigatórios");
    if (typeof path !== "string" || !path.startsWith("x1/")) throw new Error("path precisa começar com x1/");

    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.storage.from("whatsapp-media").upload(path, bytes, {
      contentType: contentType || "image/jpeg",
      upsert: true,
    });
    if (error) throw new Error(error.message);

    const url = supabase.storage.from("whatsapp-media").getPublicUrl(path).data.publicUrl;
    return new Response(JSON.stringify({ ok: true, url, bytes: bytes.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

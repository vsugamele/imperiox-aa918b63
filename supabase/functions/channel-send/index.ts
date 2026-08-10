// Envia uma mensagem para uma sessão de canal (Messenger via Zernio ou Webchat do site).
// Usado pelo openflow-executor e por ferramentas internas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { sendToChannel } from "../_shared/channel-out.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!req.headers.get("Authorization")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const { session_id, content, media_url } = await req.json();
    if (!session_id || typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "session_id e content são obrigatórios" }), { status: 400, headers: jsonHeaders });
    }

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: session } = await supa
      .from("imphq_channel_sessions").select("*").eq("id", session_id).maybeSingle();
    if (!session) {
      return new Response(JSON.stringify({ error: "sessão não encontrada" }), { status: 404, headers: jsonHeaders });
    }

    const r = await sendToChannel(supa, session as any, content, media_url || null);
    return new Response(JSON.stringify(r), { status: r.success ? 200 : 502, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: jsonHeaders });
  }
});

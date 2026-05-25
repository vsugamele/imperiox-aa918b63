// Captura clique no pitch do webinar, agenda recuperação WA e redireciona para checkout
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(p: string): string {
  let s = (p || "").replace(/\D/g, "");
  if (s.length === 10 || s.length === 11) s = "55" + s;
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("s");
  const token = url.searchParams.get("t");

  if (!sessionId || !token) {
    return new Response("Missing params", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Carrega sessão + registration
  const { data: session } = await supabase
    .from("imphq_webinar_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return new Response("Session not found", { status: 404, headers: corsHeaders });

  const { data: reg } = await supabase
    .from("imphq_webinar_registrations")
    .select("*")
    .eq("session_id", sessionId)
    .eq("lead_token", token)
    .maybeSingle();

  if (!reg) {
    return Response.redirect(session.checkout_url || "https://google.com", 302);
  }

  // Registra clique
  const { data: click } = await supabase
    .from("imphq_webinar_clicks")
    .insert({
      registration_id: reg.id,
      session_id: sessionId,
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    })
    .select("id")
    .single();

  await supabase
    .from("imphq_webinar_registrations")
    .update({ status: "clicked" })
    .eq("id", reg.id);

  // Agenda mensagens de recuperação
  const phone = normalizePhone(reg.phone || "");
  if (phone && click && Array.isArray(session.recovery_template)) {
    const now = Date.now();
    const queue = (session.recovery_template as any[]).map((step) => ({
      click_id: click.id,
      session_id: sessionId,
      project_id: session.project_id,
      phone,
      message: String(step.message || "").replace(/\[NOME\]/g, reg.nome || ""),
      send_at: new Date(now + (Number(step.delay_minutes) || 15) * 60_000).toISOString(),
      status: "pending",
    }));
    if (queue.length) await supabase.from("imphq_webinar_wa_queue").insert(queue);
  }

  return Response.redirect(session.checkout_url || "https://google.com", 302);
});

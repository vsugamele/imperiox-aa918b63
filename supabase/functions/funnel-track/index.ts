import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeFunnelEvent } from "../_shared/funnel-event.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 16384) return reply({ error: "payload_too_large" }, 413);
    let row: Record<string, unknown>;
    try { row = normalizeFunnelEvent(JSON.parse(raw)); } catch (e) { return reply({ error: e instanceof Error && /^(invalid_payload|missing_identity|invalid_event_time)$/.test(e.message) ? e.message : "invalid_payload" }, 400); }
    row.user_agent = (req.headers.get("user-agent") || "").slice(0, 500) || null;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await db.rpc("imphq_ingest_funnel_event", { p_event: row, p_origin: req.headers.get("origin") });
    if (error) { console.error("[funnel-track] ingest failed", error.code); return reply({ error: "ingest_failed" }, 503); }
    const result = data as { ok?: boolean; error?: string };
    return reply(result, result?.ok ? 200 : result?.error === "rate_limited" ? 429 : 400);
  } catch { return reply({ error: "server_error" }, 503); }
});

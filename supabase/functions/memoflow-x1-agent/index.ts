import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { decideMemoflowX1 } from "../_shared/memoflow-x1-engine.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const decision = decideMemoflowX1({
      message: String(body.message || body.text || ""),
      state: body.state || null,
      channel: body.channel || "webchat",
      checkout_url: body.checkout_url || null,
      ad_angle: body.ad_angle || null,
      lead_name: body.lead_name || null,
    });

    return new Response(JSON.stringify({ ok: true, ...decision }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[memoflow-x1-agent]", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Edge Function pública: recebe pageviews/heartbeats do snippet de funil
// Endpoint: POST /functions/v1/funnel-track
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_STEPS = new Set([
  "quiz",
  "vsl_view",
  "vsl_pitch",
  "vsl_cta_click",
  "checkout",
  "upsell1",
  "upsell2",
  "downsell1",
  "downsell2",
  "obrigado",
  "heartbeat",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      project_id,
      project,
      session_id,
      visitor_id,
      step,
      event_type,
      event_name,
      lead_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      utm_id,
      xcod,
      creative_id,
      fbclid,
      referrer,
      page_url,
      meta,
    } = body || {};

    const normalizedProjectId = project_id || project;
    const normalizedSessionId = session_id || visitor_id || crypto.randomUUID();
    const rawStep = step || event_type || event_name;
    const normalizedStep = normalizeStep(rawStep);

    if (!normalizedProjectId || !normalizedStep) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ua = req.headers.get("user-agent") || null;

    // Tenta inferir creative_id a partir do xcod (formato campaign|adset|ad)
    let inferredCreative = creative_id || null;
    if (!inferredCreative && typeof xcod === "string") {
      const parts = decodeURIComponent(xcod).split("|");
      if (parts.length >= 3) inferredCreative = parts[2];
    }

    const { error } = await supabase.from("imphq_funnel_events").insert({
      project_id: String(normalizedProjectId),
      session_id: String(normalizedSessionId),
      lead_id: lead_id ? String(lead_id) : null,
      step: normalizedStep,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
      utm_id: utm_id || null,
      xcod: xcod || null,
      creative_id: inferredCreative,
      fbclid: fbclid || null,
      referrer: referrer || null,
      user_agent: ua,
      page_url: page_url || null,
      meta: meta || {},
    });

    if (error) {
      console.error("[funnel-track] insert error", error);
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[funnel-track] error", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizeStep(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (VALID_STEPS.has(raw)) return raw;

  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    pageview: "vsl_view",
    page_view: "vsl_view",
    viewcontent: "vsl_view",
    view_content: "vsl_view",
    buttonclick: "vsl_cta_click",
    button_click: "vsl_cta_click",
    cta_click: "vsl_cta_click",
    initiatecheckout: "checkout",
    initiate_checkout: "checkout",
    addtocart: "checkout",
    add_to_cart: "checkout",
    lead: "quiz",
    leadcapture: "quiz",
    lead_capture: "quiz",
  };

  const mapped = aliases[key];
  return mapped && VALID_STEPS.has(mapped) ? mapped : null;
}

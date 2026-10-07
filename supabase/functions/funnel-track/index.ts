import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeFunnelEvent } from "../_shared/funnel-event.ts";
import { buildUserData, matchKeys, sendCapi, STEP_TO_META } from "../_shared/meta-capi.ts";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
type Db = ReturnType<typeof createClient>;
interface PixelCfg { pixel: string | null; token: string | null; test: string | null; at: number }
const pixelCache = new Map<string, PixelCfg>();

async function pixelConfig(db: Db, projectId: string): Promise<PixelCfg> {
  const hit = pixelCache.get(projectId);
  if (hit && Date.now() - hit.at < 300_000) return hit;
  const { data } = await db.from("imphq_projects").select("fb_pixel_id, fb_access_token, fb_test_event_code").eq("id", projectId).maybeSingle();
  const cfg = { pixel: data?.fb_pixel_id ?? null, token: data?.fb_access_token ?? null, test: data?.fb_test_event_code ?? null, at: Date.now() };
  pixelCache.set(projectId, cfg);
  return cfg;
}

/** Espelha no servidor (CAPI) o mesmo evento que o Pixel disparou no navegador, com o mesmo event_id. */
async function forwardToMeta(db: Db, row: Record<string, unknown>, req: Request) {
  const step = String(row.step);
  const eventName = STEP_TO_META[step];
  const eventId = typeof row.event_id === "string" ? row.event_id : null;
  if (!eventName || !eventId) return;
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  if (meta.validation === true) return;
  const cfg = await pixelConfig(db, String(row.project_id));
  if (!cfg.pixel || !cfg.token) return;
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const atMs = Date.parse(String(row.event_at)) || Date.now();
  const userData = await buildUserData({
    externalId: typeof row.visitor_id === "string" ? row.visitor_id : null,
    fbp: typeof meta.fbp === "string" ? meta.fbp : null,
    fbc: typeof meta.fbc === "string" ? meta.fbc : null,
    fbclid: typeof row.fbclid === "string" ? row.fbclid : null,
    ip, userAgent: typeof row.user_agent === "string" ? row.user_agent : null,
  }, atMs);
  const custom: Record<string, unknown> = { funnel_step: step };
  for (const k of ["utm_source", "utm_campaign", "utm_content", "ad_id", "campaign_id"]) if (row[k]) custom[k] = row[k];
  if (typeof meta.offer_id === "string") custom.content_ids = [meta.offer_id];
  const result = await sendCapi(cfg.pixel, cfg.token, [{
    event_name: eventName, event_time: Math.floor(atMs / 1000), event_id: eventId, action_source: "website",
    event_source_url: typeof row.page_url === "string" ? row.page_url : undefined, user_data: userData, custom_data: custom,
  }], { testEventCode: cfg.test });
  await db.from("imphq_capi_log").insert({
    project_id: row.project_id, pixel_id: cfg.pixel, event_name: eventName, event_id: eventId, source: "tracker",
    match_keys: matchKeys(userData), ok: result.ok, http_status: result.status, error: result.error ?? null,
    fbtrace_id: result.fbtrace_id ?? null, test_mode: !!cfg.test,
  });
}

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
    const result = data as { ok?: boolean; error?: string; duplicate?: boolean };
    if (result?.ok && !result.duplicate) {
      const job = forwardToMeta(db, row, req).catch((e) => console.error("[funnel-track] capi failed", e instanceof Error ? e.message : e));
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job); else await job;
    }
    return reply(result, result?.ok ? 200 : result?.error === "rate_limited" ? 429 : 400);
  } catch { return reply({ error: "server_error" }, 503); }
});

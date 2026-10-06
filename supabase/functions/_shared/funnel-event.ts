import { record } from "./value.ts";
const STEPS = new Set(["advertorial_view", "advertorial_cta_click", "pdp_view", "pdp_cta_click", "quiz", "vsl_view", "vsl_pitch", "vsl_cta_click", "checkout", "upsell1", "upsell2", "downsell1", "downsell2", "obrigado", "heartbeat", "vsl_play", "vsl_25", "vsl_50", "vsl_75", "vsl_90", "vsl_complete", "vsl_instrumented", "vsl_cta_visible", "add_to_cart"]);
const ALIASES: Record<string, string> = { pageview: "vsl_view", page_view: "vsl_view", viewcontent: "vsl_view", view_content: "vsl_view", buttonclick: "vsl_cta_click", button_click: "vsl_cta_click", cta_click: "vsl_cta_click", initiatecheckout: "checkout", initiate_checkout: "checkout", addtocart: "add_to_cart", add_to_cart: "add_to_cart", lead: "quiz", leadcapture: "quiz", lead_capture: "quiz" };
const text = (v: unknown, limit = 500): string | null => typeof v === "string" && v.trim() ? v.trim().slice(0, limit) : null;
const safeDecode = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };
const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "xcod", "creative_id", "fbclid", "gclid", "msclkid", "ttclid", "campaign_id", "adset_id", "ad_id"];
function touch(v: unknown): Record<string, unknown> {
  const t = record(v); const p = record(t.params); const params: Record<string, string> = {};
  for (const k of ATTR_KEYS) { const s = text(p[k]); if (s) params[k] = s; }
  return { params, at: text(t.at, 40), landing: cleanTrackerUrl(t.landing) };
}
function metadata(v: unknown): Record<string, unknown> {
  const source = record(v); const out: Record<string, unknown> = {};
  for (const k of ["offer_id", "player_id", "link_id", "tracker_version", "validation", "qa_source", "page_type", "destination_host", "pitch_evidence", "position_seconds", "duration_seconds", "pitch_configured", "retention_configured", "player_api"]) {
    if (typeof source[k] === "string") out[k] = text(source[k]);
    else if (typeof source[k] === "boolean" || typeof source[k] === "number") out[k] = source[k];
  }
  return out;
}
export function cleanTrackerUrl(v: unknown): string | null {
  const s = text(v, 4096); if (!s) return null;
  try { const u = new URL(s); if (!/^https?:$/.test(u.protocol)) return null; return u.origin + u.pathname; } catch { return null; }
}
export function normalizeFunnelEvent(input: unknown, receivedAt = new Date()): Record<string, unknown> {
  const b = record(input); const raw = text(b.step || b.event_type || b.event_name);
  const normalized = raw?.toLowerCase().replace(/[\s-]+/g, "_");
  const step = raw && STEPS.has(raw) ? raw : normalized ? ALIASES[normalized] : null;
  const project = text(b.project_id || b.project, 100);
  if (!project || !step) throw new Error("invalid_payload");
  const m = metadata(b.meta); const v2 = m.tracker_version === "TRK1.1";
  const session = text(b.session_id, 200); const eventId = text(b.event_id, 200);
  if (v2 && (!session || !eventId)) throw new Error("missing_identity");
  const occurred = text(b.event_at, 40); const timestamp = occurred ? Date.parse(occurred) : NaN;
  if (occurred && (!Number.isFinite(timestamp) || timestamp > receivedAt.getTime() + 300000 || timestamp < receivedAt.getTime() - 86400000)) throw new Error("invalid_event_time");
  const xcod = text(b.xcod); const parts = xcod ? safeDecode(xcod).split("|") : [];
  const row: Record<string, unknown> = {
    project_id: project, session_id: session, visitor_id: text(b.visitor_id, 200), event_id: eventId,
    event_at: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : receivedAt.toISOString(),
    step, lead_id: text(b.lead_id, 200), click_id: text(b.click_id || b.imp_click_id, 200),
    xcod, creative_id: text(b.creative_id || b.ad_id || parts[2]), campaign_id: text(b.campaign_id || parts[0]),
    adset_id: text(b.adset_id || parts[1]), ad_id: text(b.ad_id || b.creative_id || parts[2]),
    page_url: cleanTrackerUrl(b.page_url), referrer: cleanTrackerUrl(b.referrer),
    first_touch: touch(b.first_touch), last_touch: touch(b.last_touch),
    meta: { ...m, identity_missing: !session, received_at: receivedAt.toISOString() },
  };
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "fbclid"]) row[k] = text(b[k]);
  return row;
}

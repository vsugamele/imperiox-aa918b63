import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { record } from "./value.ts";

export async function resolveSaleJourney(db: SupabaseClient, project: string | null, click: string | null, soldAt: string | null): Promise<Record<string, unknown>> {
  if (!project || !click) return { confidence: "unknown", method: "none" };
  const at = soldAt && Number.isFinite(Date.parse(soldAt)) ? new Date(soldAt) : new Date();
  const { data, error } = await db.from("imphq_funnel_events")
    .select("session_id,visitor_id,click_id,ad_id,creative_id,campaign_id,adset_id,first_touch,last_touch,meta,event_at,utm_source")
    .eq("project_id", project).eq("click_id", click).neq("step", "heartbeat")
    .gte("event_at", new Date(at.getTime() - 30 * 86400000).toISOString())
    .lte("event_at", new Date(at.getTime() + 300000).toISOString())
    .order("event_at", { ascending: false }).limit(10);
  if (error) throw error;
  const row = data?.find((r) => String(record(r.meta).validation).toLowerCase() !== "true" && r.utm_source !== "codex-validation");
  if (!row) return { confidence: "unknown", method: "none" };
  return { confidence: "confirmed", method: "click_id", session_id: row.session_id, visitor_id: row.visitor_id,
    click_id: row.click_id, ad_id: row.ad_id || row.creative_id, campaign_id: row.campaign_id, adset_id: row.adset_id,
    first_touch: row.first_touch, last_touch: row.last_touch, matched_event_at: row.event_at };
}

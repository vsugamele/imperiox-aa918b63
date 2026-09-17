import { z } from "zod";

const number = z.number().optional();
const text = z.string().optional();
export const zernioStatsSchema = z.object({ imported: number, ads: number, campaigns: number, insights_empty: number, insights_failures: number, chosen_insights_variant: text, inline_metrics_used: number, ads_zero_forcing_insights: number, days_imported: number, campaign_placeholders: number }).passthrough();
export const zernioDebugSchema = z.object({
  campaigns_detected: z.array(z.object({ name: text, ads_count: number, status: text })).optional(),
  variants_tried: z.array(z.object({ name: text, campaigns_count: number, campaigns_status: number, ads_count: number, ads_status: number, campaigns_keys: z.array(z.string()).optional(), ads_keys: z.array(z.string()).optional() })).optional(),
  chosen_variant: text,
  sample_empty_insight: z.object({ adId: text, status: number, keys: z.array(z.string()).optional() }).optional(),
}).passthrough();

import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonNumber, jsonText } from "@/lib/json-fields";

/**
 * Computes the average confidence across `_avatar_meta` entries.
 * Returns null if no entries with numeric score.
 */
export function computeAvatarHealthScore(avatar: Json): { avg: number | null; total: number; filled: number } {
  const meta = jsonFields(jsonFields(avatar)._avatar_meta);
  const entries = Object.values(meta).map(value => ({ score: jsonNumber(jsonFields(value).score) }));
  const scored = entries.filter(e => typeof e?.score === "number");
  if (scored.length === 0) return { avg: null, total: entries.length, filled: 0 };
  const sum = scored.reduce((s, e) => s + (e.score || 0), 0);
  return { avg: Math.round(sum / scored.length), total: entries.length, filled: scored.length };
}

export function avatarConfidence(value: Json | undefined) {
  const entry = jsonFields(value);
  const ids = entry.evidence_ids;
  return { score: jsonNumber(entry.score), reason: jsonText(entry.reason), source: jsonText(entry.source), evidence_ids: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [] };
}

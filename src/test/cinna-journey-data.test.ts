import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], messages: [] as Record<string, unknown>[], error: false, ranges: [] as number[][], filters: [] as [string, unknown][] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let start = 0; let end = 249;
  const query = {
    select: () => query, eq: (key: string, value: unknown) => { db.filters.push([key, value]); return query; },
    lte: (key: string, value: unknown) => { db.filters.push([key, value]); return query; },
    gte: (key: string, value: unknown) => { db.filters.push([key, value]); return query; }, order: () => query,
    range: (a: number, b: number) => { start = a; end = b; db.ranges.push([a, b]); return query; }, in: () => query,
    abortSignal: async () => { const rows = table === "imphq_channel_messages" ? db.messages : db.rows; return { data: db.error ? null : rows.slice(start, end + 1), count: rows.length, error: db.error ? { message: "denied" } : null }; },
  }; return query;
} } }));
import { loadCinnaJourney, loadJourneyMessages, JOURNEY_LIMIT } from "@/lib/cinna-shield-x1/journey-data";
beforeEach(() => { db.rows = []; db.messages = []; db.ranges = []; db.filters = []; db.error = false; });
describe("Cinna history queries", () => {
  it("loads all pages within coverage instead of silently truncating at the API limit", async () => {
    db.rows = Array.from({ length: 501 }, (_, i) => ({ id: `e${i}`, step_results: [] }));
    const result = await loadCinnaJourney(30, new AbortController().signal);
    expect(result).toMatchObject({ loaded: 501, total: 501, unrecognized: 501, conversations: [] });
    expect(db.ranges).toEqual([[0, 249], [250, 499], [500, 749]]);
    expect(db.filters).toContainEqual(["automacao_id", "cinna-shield-x1-native"]);
    expect(db.filters.some(([key]) => key === "created_at")).toBe(true);
  });
  it("reports the total when the bounded scan is partial", async () => {
    db.rows = Array.from({ length: JOURNEY_LIMIT + 1 }, (_, i) => ({ id: `e${i}`, step_results: [] }));
    const result = await loadCinnaJourney(0, new AbortController().signal);
    expect(result.loaded).toBe(JOURNEY_LIMIT); expect(result.total).toBe(JOURNEY_LIMIT + 1);
  });
  it("does not turn a permission or network error into zero metrics", async () => {
    db.error = true;
    await expect(loadCinnaJourney(7, new AbortController().signal)).rejects.toMatchObject({ message: "denied" });
    await expect(loadJourneyMessages("session", 0, "2026-09-08", new AbortController().signal)).rejects.toMatchObject({ message: "denied" });
  });
  it("reads only the selected session and keeps each historical page chronological", async () => {
    db.messages = Array.from({ length: 60 }, (_, i) => ({ id: String(60 - i), direction: "in", created_at: "2026-09-08T10:00:00Z" }));
    const first = await loadJourneyMessages("specific-session", 0, "2026-09-08T11:00:00Z", new AbortController().signal);
    const older = await loadJourneyMessages("specific-session", 50, "2026-09-08T11:00:00Z", new AbortController().signal);
    expect(first.messages[0].id).toBe("11"); expect(first.messages.at(-1)?.id).toBe("60");
    expect(older.messages.map(item => item.id)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(db.filters).toContainEqual(["session_id", "specific-session"]);
    expect(db.filters).toContainEqual(["created_at", "2026-09-08T11:00:00Z"]);
  });
});

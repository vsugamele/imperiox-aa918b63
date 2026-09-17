import { describe, expect, it, vi } from "vitest";
import { fetchAll } from "@/lib/supabasePaginate";

describe("typed Supabase pagination", () => {
  it("keeps row values and pagination bounds while respecting the cap", async () => {
    const calls: [number, number][] = [];
    const records = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const rows = await fetchAll(async (from, to) => {
      calls.push([from, to]);
      return { data: records.slice(from, to + 1), error: null };
    }, 2, 3);
    expect(rows).toEqual(records.slice(0, 3));
    expect(calls).toEqual([[0, 1], [2, 3]]);
  });
  it("preserves successfully fetched pages when the next page fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const rows = await fetchAll(async (from) => from === 0
        ? { data: [{ id: "a" }], error: null }
        : { data: null, error: { message: "unavailable" } }, 1, 3);
      expect(rows).toEqual([{ id: "a" }]);
      expect(log).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); }
  });
});

import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { readPages } from "@/lib/marketing-load";
describe("Source pagination", () => {
  function factory(pages: Array<{ data: unknown; error: unknown }>) {
    const ranges: Array<[number,number]> = [];
    const create = () => ({ order: () => ({ range: (from: number,to: number) => { ranges.push([from,to]); return Promise.resolve(pages[ranges.length-1] ?? { data: [], error: null }); } }) });
    return { create: create as unknown as Parameters<typeof readPages>[0], ranges };
  }
  it("does not silently truncate Supabase's first 1000 rows", async () => {
    const f = factory([{ data: Array.from({ length: 1000 },(_,i) => ({ id: i })), error: null }, { data: [{ id: 1000 }], error: null }]);
    const r = await readPages(f.create); expect(r.rows).toHaveLength(1001); expect(r.truncated).toBe(false); expect(f.ranges).toEqual([[0,999],[1000,1999]]);
  });
  it("discards partial pages on source error instead of claiming complete data", async () => {
    const f = factory([{ data: Array(1000).fill({ id: 1 }), error: null }, { data: null, error: { message: "denied" } }]);
    expect(await readPages(f.create)).toEqual({ rows: [], error: true, truncated: false });
  });
  it("reports the cap as incomplete", async () => {
    const f = factory(Array(20).fill({ data: Array(1000).fill({ id: 1 }), error: null }));
    expect((await readPages(f.create)).truncated).toBe(true); expect(f.ranges).toHaveLength(20);
  });
});

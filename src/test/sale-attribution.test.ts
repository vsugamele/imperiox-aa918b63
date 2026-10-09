import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorText, record } from "@shared/value";

interface AttributionRow {
  id: string;
  attribution_id: string;
  sent_at: string;
  metadata: unknown;
}
interface DbReply {
  data: AttributionRow | null;
  error: { message: string; code?: string } | null;
}
interface QueryCall {
  table: string;
  operation: "select" | "update";
  filters: { operator: "eq" | "gte" | "lte" | "is"; column: string; value: unknown }[];
  order?: { column: string; ascending: boolean };
  limit?: number;
  update?: Record<string, unknown>;
}
interface DbQuery extends Promise<DbReply> {
  select(columns: string): DbQuery;
  eq(column: string, value: unknown): DbQuery;
  gte(column: string, value: unknown): DbQuery;
  lte(column: string, value: unknown): DbQuery;
  is(column: string, value: unknown): DbQuery;
  order(column: string, options: { ascending: boolean }): DbQuery;
  limit(limit: number): DbQuery;
  update(values: Record<string, unknown>): DbQuery;
  maybeSingle(): Promise<DbReply>;
}

function database(replies: DbReply[]) {
  const calls: QueryCall[] = [];
  const from = vi.fn((table: string) => {
    const reply = replies[calls.length] || { data: null, error: null };
    const call: QueryCall = { table, operation: "select", filters: [] };
    calls.push(call);
    const query: DbQuery = Object.assign(Promise.resolve(reply), {
      select: () => query,
      eq: (column: string, value: unknown) => { call.filters.push({ operator: "eq", column, value }); return query; },
      gte: (column: string, value: unknown) => { call.filters.push({ operator: "gte", column, value }); return query; },
      lte: (column: string, value: unknown) => { call.filters.push({ operator: "lte", column, value }); return query; },
      is: (column: string, value: unknown) => { call.filters.push({ operator: "is", column, value }); return query; },
      order: (column: string, options: { ascending: boolean }) => { call.order = { column, ...options }; return query; },
      limit: (limit: number) => { call.limit = limit; return query; },
      update: (values: Record<string, unknown>) => { call.operation = "update"; call.update = values; return query; },
      maybeSingle: () => Promise.resolve(reply),
    });
    // Deliberately no .or(): user-provided IDs must remain standalone eq values.
    return query;
  });
  return { db: { from }, calls };
}

interface SaleOptions {
  project_id: string;
  venda_id: string;
  venda_status: string;
  click_id?: string | null;
  phone?: string | null;
  produto_nome?: string | null;
  valor?: number;
  data_venda?: string | null;
}
type LinkSale = (db: ReturnType<typeof database>["db"], opts: SaleOptions) => Promise<string | null>;

// Reuse quality-backend's transpilation pattern: execute the actual Deno source
// while erasing its remote type import, with only its local value helpers supplied.
function loadAttribution(): Record<string, unknown> {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/_shared/attribution.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  const exports: Record<string, unknown> = {};
  new Function("exports", "require", outputText)(exports, (name: string) => {
    if (name === "./value.ts") return { errorText, record };
    throw new Error(`Unexpected runtime import: ${name}`);
  });
  if (typeof exports.linkSaleToAttribution !== "function") throw new Error("Missing linkSaleToAttribution");
  return exports;
}
const attribution = loadAttribution();
const linkSaleToAttribution = attribution.linkSaleToAttribution as LinkSale;
const empty: DbReply = { data: null, error: null };
const sale: SaleOptions = {
  project_id: "project-1", venda_id: "sale-1", venda_status: "aprovado",
  click_id: "click-1", phone: "5511999999999", produto_nome: "Produto A",
  data_venda: "2026-10-06T12:00:00.000Z",
};
function match(id: string, sentAt = "2026-10-05T12:00:00.000Z"): DbReply {
  return { data: { id, attribution_id: `attr-${id}`, sent_at: sentAt, metadata: { source: "retained" } }, error: null };
}
function expectExplicitScope(call: QueryCall, column: "click_id" | "attribution_id", value: string) {
  expect(call.table).toBe("imphq_wa_attribution");
  expect(call.filters).toEqual([
    { operator: "eq", column, value },
    { operator: "eq", column: "project_id", value: "project-1" },
    { operator: "gte", column: "sent_at", value: "2026-09-06T12:00:00.000Z" },
    { operator: "lte", column: "sent_at", value: "2026-10-06T12:05:00.000Z" },
  ]);
  expect(call.order).toEqual({ column: "sent_at", ascending: false });
  expect(call.limit).toBe(1);
}
afterEach(() => vi.useRealTimers());

describe("TRK1.1 WhatsApp sale attribution", () => {
  it.each(["click_id", "attribution_id"] as const)("confirms an explicit %s with safe ID/project/time scopes and writes the sale click", async column => {
    const input = "id,project_id.eq.other),(sent_at.gt.2099-01-01)";
    const app = database(column === "click_id" ? [match("explicit"), empty, empty, empty] : [empty, match("explicit"), empty, empty]);
    expect(await linkSaleToAttribution(app.db, { ...sale, click_id: input })).toBe("attr-explicit");
    expectExplicitScope(app.calls[0], "click_id", input);
    expectExplicitScope(app.calls[1], "attribution_id", input);
    expect(app.calls).toHaveLength(4);
    expect(app.calls[2]).toMatchObject({ table: "imphq_wa_attribution", operation: "update",
      update: { venda_id: "sale-1", venda_status: "aprovado", click_id: input,
        metadata: { source: "retained", match_method: "click_id", match_confidence: "confirmed" } },
      filters: [{ operator: "eq", column: "id", value: "explicit" }],
    });
    // O código voltou no aviso da plataforma: conta como clique no link da mensagem.
    expect((app.calls[2] as { update: Record<string, unknown> }).update.clicked_at).toEqual(expect.any(String));
    expect(app.calls[3]).toMatchObject({ table: "imphq_vendas", operation: "update", update: { click_id: input },
      filters: [{ operator: "eq", column: "id", value: "sale-1" }, { operator: "eq", column: "project_id", value: "project-1" }],
    });
  });

  it.each([true, false])("preserves newest-match selection across both ID queries (click match newer: %s)", async clickNewer => {
    const recent = "2026-10-06T11:00:00.000Z";
    const older = "2026-10-04T12:00:00.000Z";
    const app = database([match("click", clickNewer ? recent : older), match("attr", clickNewer ? older : recent), empty, empty]);
    expect(await linkSaleToAttribution(app.db, sale)).toBe(clickNewer ? "attr-click" : "attr-attr");
    expect(app.calls[2].filters).toContainEqual({ operator: "eq", column: "id", value: clickNewer ? "click" : "attr" });
    expect(app.calls).toHaveLength(4);
  });

  it("retains phone+product inference within the previous seven days and never writes an unmatched sale click", async () => {
    const app = database([empty, empty, match("inferred"), empty]);
    expect(await linkSaleToAttribution(app.db, sale)).toBe("attr-inferred");
    expect(app.calls[2].filters).toEqual([
      { operator: "eq", column: "project_id", value: "project-1" },
      { operator: "eq", column: "phone", value: sale.phone },
      { operator: "eq", column: "produto_nome", value: sale.produto_nome },
      { operator: "gte", column: "sent_at", value: "2026-09-29T12:00:00.000Z" },
      { operator: "lte", column: "sent_at", value: sale.data_venda },
      { operator: "is", column: "venda_id", value: null },
    ]);
    expect(app.calls[2].order).toEqual({ column: "sent_at", ascending: false });
    expect(app.calls[2].limit).toBe(1);
    expect(app.calls[3].update?.metadata).toEqual({ source: "retained", match_method: "phone_product_7d", match_confidence: "inferred" });
    // Casamento só por telefone não prova que o link foi aberto.
    expect(app.calls[3].update).not.toHaveProperty("clicked_at");
    expect(app.calls.every(call => call.table !== "imphq_vendas")).toBe(true);
  });

  it("allows inference without an explicit ID and keeps the sale click untouched", async () => {
    const app = database([match("inferred"), empty]);
    expect(await linkSaleToAttribution(app.db, { ...sale, click_id: null })).toBe("attr-inferred");
    expect(app.calls).toHaveLength(2);
    expect(app.calls[1].update?.metadata).toMatchObject({ match_method: "phone_product_7d", match_confidence: "inferred" });
    expect(app.calls.every(call => call.table !== "imphq_vendas")).toBe(true);
  });

  it.each([{ phone: null }, { produto_nome: null }])("requires both phone and product for inference: %j", async missing => {
    const app = database([empty, empty]);
    expect(await linkSaleToAttribution(app.db, { ...sale, ...missing })).toBeNull();
    expect(app.calls).toHaveLength(2);
    expect(app.calls.every(call => call.operation === "select")).toBe(true);
  });

  it("returns null without writes when all exact and inferred lookups miss", async () => {
    const app = database([empty, empty, empty]);
    expect(await linkSaleToAttribution(app.db, sale)).toBeNull();
    expect(app.calls).toHaveLength(3);
    expect(app.calls.every(call => call.operation === "select")).toBe(true);
  });

  it.each([0, 1])("propagates DB error from exact lookup %i, even if the other lookup matched, without fallback/writes", async failingLookup => {
    const error = { message: "lookup failed", code: "08006" };
    const replies = [match("valid"), match("valid")];
    replies[failingLookup] = { data: null, error };
    const app = database(replies);
    await expect(linkSaleToAttribution(app.db, sale)).rejects.toBe(error);
    expect(app.calls).toHaveLength(2);
    expect(app.calls.every(call => call.operation === "select")).toBe(true);
  });

  it("propagates the fallback DB error instead of treating it as a missing match", async () => {
    const error = { message: "fallback failed" };
    const app = database([empty, empty, { data: null, error }]);
    await expect(linkSaleToAttribution(app.db, sale)).rejects.toBe(error);
    expect(app.calls).toHaveLength(3);
    expect(app.calls.every(call => call.operation === "select")).toBe(true);
  });

  it.each(["attribution", "sale"] as const)("propagates the %s write error", async write => {
    const error = { message: `${write} write failed` };
    const failed: DbReply = { data: null, error };
    const app = database([match("explicit"), empty, write === "attribution" ? failed : empty, failed]);
    await expect(linkSaleToAttribution(app.db, sale)).rejects.toBe(error);
    expect(app.calls).toHaveLength(write === "attribution" ? 3 : 4);
  });

  it.each([null, "invalid-date"])("uses one consistent current-time anchor when sale timestamp is %s", async dataVenda => {
    vi.useFakeTimers().setSystemTime(new Date(sale.data_venda || ""));
    const app = database([empty, empty, empty]);
    expect(await linkSaleToAttribution(app.db, { ...sale, data_venda: dataVenda })).toBeNull();
    expectExplicitScope(app.calls[0], "click_id", "click-1");
    expectExplicitScope(app.calls[1], "attribution_id", "click-1");
    expect(app.calls[2].filters).toContainEqual({ operator: "lte", column: "sent_at", value: sale.data_venda });
  });
});

describe("OF2.1 WhatsApp link code returns through Ticto sck", () => {
  const inject = attribution.injectAttributionParam as (url: string, id: string) => string;
  const fromSck = attribution.attributionFromSck as (sck: unknown) => string | null;
  it("adds sck=wa_<id> without overwriting an existing sck", () => {
    const url = new URL(inject("https://checkout.ticto.app/O854B666F?utm_source=wa", "abc123def456"));
    expect(url.searchParams.get("sck")).toBe("wa_abc123def456");
    expect(url.searchParams.get("xc")).toBe("abc123def456");
    expect(new URL(inject("https://checkout.ticto.app/X?sck=meta-ads", "abc")).searchParams.get("sck")).toBe("meta-ads");
  });
  it("reads only wa_ codes back", () => {
    expect(fromSck("wa_abc123def456")).toBe("abc123def456");
    expect(fromSck("wa_")).toBeNull();
    expect(fromSck("campanha|conjunto")).toBeNull();
    expect(fromSck(undefined)).toBeNull();
  });
});

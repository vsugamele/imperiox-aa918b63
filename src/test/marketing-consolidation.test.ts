import { describe, expect, it } from "vitest";
import { consolidateAds, consolidateEvents, consolidateSales, coverage, type Row } from "@/lib/marketing-consolidation";
import { radarResearch, seoNoteId, parseSeo, SEO_PREFIX } from "@/lib/seo-research";
const since = "2026-10-01T00:00:00.000Z", until = "2026-10-08T00:00:00.000Z";
const sale = (extra: Row = {}): Row => ({ id: "r1", project_id: "jp_freitas", plataforma: "Ticto", external_transaction_id: "TX1", produto_id_ext: "P1", status: "aprovado", tipo_venda: "principal", data_venda: "2026-10-02T12:00:00.000Z", created_at: "2026-10-02T12:00:00.000Z", valor: 47, valor_liquido: 40, data: { moeda: "BRL" }, ...extra });
describe("Marketing reconciliation", () => {
  it("distinguishes missing, unavailable, truncation, stale and confirmed zero coverage", () => {
    expect(coverage({ rows: 0 })).toBe("missing");
    expect(coverage({ rows: 0, error: true })).toBe("unavailable");
    expect(coverage({ rows: 20000, truncated: true })).toBe("incomplete");
    expect(coverage({ rows: 1, lastSuccess: "2026-01-01" }, Date.parse(since))).toBe("stale");
    expect(coverage({ rows: 1 })).toBe("observed");
    expect(coverage({ rows: 0, complete: true })).toBe("confirmed");
    expect(consolidateSales([], since, until).totals).toEqual({});
  });
  it("deduplicates transactions/components, bumps add revenue without duplicating orders", () => {
    const main = sale(), bump = sale({ id: "b1", tipo_venda: "orderbump", produto_id_ext: "P2", valor: 27, valor_liquido: 20 });
    const result = consolidateSales([main, { ...main, id: "duplicate" }, bump, { ...bump, id: "b2" }], since, until);
    expect(result.totals.BRL).toEqual({ orders: 1, gross: 74, net: 60 });
    expect(result.duplicates).toBe(2);
  });
  it("applies later refund and excludes pending/declined/unidentified transactions", () => {
    const result = consolidateSales([sale(), sale({ id: "refund", status: "reembolsado", created_at: "2026-10-09T00:00:00Z" }), sale({ external_transaction_id: "pending", status: "pendente" }), sale({ external_transaction_id: "declined", status: "recusado" }), sale({ external_transaction_id: null })], since, until);
    expect(result.totals).toEqual({}); expect(result.missingIdentity).toBe(1);
  });
  it("filters by data_venda and flags fallback and unknown currency without inventing values", () => {
    const r = consolidateSales([sale({ data_venda: "2026-09-01T00:00:00Z" }), sale({ external_transaction_id: "TX2", data_venda: null, valor_liquido: null, data: {} })], since, until);
    expect(r.totals.UNKNOWN).toEqual({ orders: 1, gross: 47, net: null }); expect(r.fallbackDates).toBe(1); expect(r.unknownCurrency).toBe(1);
  });
  it("separates currencies and accepts measured zero, even when gross and net differ", () => {
    const r = consolidateSales([sale(), sale({ external_transaction_id: "TX2", data: { moeda: "USD" }, valor: 0, valor_liquido: 0 })], since, until);
    expect(r.totals.BRL.gross).toBe(47); expect(r.totals.USD).toEqual({ orders: 1, gross: 0, net: 0 });
  });
  it("does not count heartbeat or QA as sessions and deduplicates the same session across tables", () => {
    const e = (extra: Row): Row => ({ session_id: "s1", ...extra });
    expect(consolidateEvents([e({ event_name: "PageView" }), e({ step: "vsl_view" }), e({ step: "heartbeat", session_id: "h" }), e({ step: "checkout" }), e({ event_name: "PageView", session_id: "qa", metadata: { validation: true } }), e({ step: "checkout", session_id: "qa2", meta: { qa_source: "test" } }), e({ event_name: "PageView", session_id: null })])).toEqual({ pageSessions: 1, checkoutSessions: 1, excluded: 2, missingIdentity: 1, bridgeDuplicates: 0, legacyBridges: 0 });
  });
  it("deduplicates TRK1.4 by origin id and preserves legacy event semantics", () => {
    const r = consolidateEvents([{ id: "old1", event_name: "PageView", session_id: "s1" }, { event_id: "legacy_old1", step: "vsl_view", session_id: "s1", meta: { source: "legacy_events", legacy_event: "PageView" } }, { event_id: "legacy_old2", step: "vsl_play", session_id: "s2", meta: { source: "legacy_events", legacy_event: "ViewContent" } }, { step: "quiz", session_id: "s3", meta: { source: "legacy_events", legacy_event: "Lead" } }]);
    expect(r.pageSessions).toBe(1); expect(r.checkoutSessions).toBe(0); expect(r.bridgeDuplicates).toBe(1); expect(r.legacyBridges).toBe(3);
  });
  it("keeps Meta/Zernio separate, excludes campaign totals when detail exists, preserves 0", () => {
    const ad = (extra: Row): Row => ({ source: "meta", plataforma: "Facebook", moeda: "BRL", data_ref: "2026-10-02", ad_id: "A1", valor: 0, landing_page_views: 0, init_checkout: 0, ...extra });
    const result = consolidateAds([ad({}), ad({ ad_id: "CAMP:C1", valor: 100 }), ad({ source: "zernio", valor: 10 })]);
    expect(result).toHaveLength(2); expect(result[0].spend).toBe(0); expect(result[0].excluded).toBe(1); expect(result[1].spend).toBe(10);
  });
  it("rejects ambiguous ad identities rather than adding unsupported totals", () => { expect(consolidateAds([{ source: "legacy", valor: 50 }])[0].spend).toBeNull(); });
  it("does not interpret the collector's CAMP placeholders as real zero spend", () => { expect(consolidateAds([{ source: "zernio", ad_id: "CAMP:123", valor: 0 }])[0].spend).toBeNull(); });
  it("compares timestamp instants including offsets, with an exclusive upper boundary", () => {
    expect(consolidateSales([sale({ data_venda: "2026-10-01T00:00:00+00:00" })], since, until).totals.BRL.orders).toBe(1);
    expect(consolidateSales([sale({ data_venda: "2026-10-08T00:00:00+00:00" })], since, until).totals).toEqual({});
  });
});
describe("SEO evidence and idempotent import", () => {
  const report = { project: "Healthy Legs Daily", generated_at: "2026-10-05T19:47:18.541Z", opportunities: [{ keyword: "heavy legs", source: "google-suggest", score: 28, risk: "low" }] };
  it("preserves collection date and evidence with heuristic score and no volume", async () => {
    const [r] = radarResearch(report);
    expect(r.collectedAt).toBe(report.generated_at); expect(r.volume).toBeNull(); expect(r.raw.risk).toBe("low");
    expect(await seoNoteId("linfaflow", r)).toBe(await seoNoteId("linfaflow", { ...r, decision: "Revisar", result: "Em análise" }));
    expect(await seoNoteId("linfaflow", r)).not.toBe(await seoNoteId("jp_freitas", r));
    expect(parseSeo(SEO_PREFIX + JSON.stringify(r))).toEqual(r); expect(parseSeo("nota comum")).toBeNull();
  });
  it("does not infer a project or accept reports without original date", () => { expect(() => radarResearch({ ...report, project: "other" })).toThrow(); expect(() => radarResearch({ ...report, generated_at: null })).toThrow(); });
});

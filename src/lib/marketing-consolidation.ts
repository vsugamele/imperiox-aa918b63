/** Read-only consolidation. No attribution inferred from UTMs, no FX conversion. */
export type Row = Record<string, unknown>;
export const object = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const number = (v: unknown): number | null => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
const round = (v: number) => Math.round(v * 100) / 100;
const paid = new Set(["aprovado", "approved", "paid", "completed"]);
const refunded = new Set(["reembolsado", "refunded", "chargeback"]);
const status = (r: Row) => text(r.status).toLowerCase();
const bump = (r: Row) => /bump/i.test(text(r.tipo_venda));
export function saleIdentity(r: Row): string | null {
  const d = object(r.data);
  const transaction = text(r.external_transaction_id);
  if (!transaction) return null;
  const component = bump(r) ? text(r.produto_id_ext) || text(r.bump_product_id) || text(d.bump_product_id) || text(r.bump_offer_code) || text(d.bump_offer_code) || text(r.produto_nome) : text(r.produto_id_ext) || text(r.produto_nome) || "principal";
  if (!component) return null;
  return JSON.stringify([r.project_id, r.plataforma, transaction, bump(r) ? "bump" : "principal", component]);
}
export function consolidateSales(rows: Row[], since: string, until: string) {
  const components = new Map<string, Row>();
  let missingIdentity = 0;
  for (const r of rows) {
    const key = saleIdentity(r);
    if (!key) { missingIdentity++; continue; }
    const old = components.get(key);
    // A refund overrides a duplicate approval; timestamps here are receipt/sale time, not status version.
    if (!old || refunded.has(status(r)) || (!refunded.has(status(old)) && String(r.created_at ?? "") >= String(old.created_at ?? ""))) components.set(key, r);
  }
  // Refund of the main transaction also invalidates its bumps.
  const revoked = new Set([...components.values()].filter(r => !bump(r) && refunded.has(status(r))).map(r => JSON.stringify([r.project_id, r.plataforma, r.external_transaction_id])));
  const totals: Record<string, { orders: number; gross: number | null; net: number | null }> = {};
  const orders = new Set<string>();
  let fallbackDates = 0;
  let unknownCurrency = 0;
  const evidence: Row[] = [];
  for (const r of components.values()) {
    const date = text(r.data_venda) || text(r.created_at);
    const at = Date.parse(date);
    if (!Number.isFinite(at) || at < Date.parse(since) || at >= Date.parse(until) || !paid.has(status(r)) || revoked.has(JSON.stringify([r.project_id, r.plataforma, r.external_transaction_id]))) continue;
    if (!text(r.data_venda)) fallbackDates++;
    const currency = (text(r.currency) || text(object(r.data).moeda)).toUpperCase() || "UNKNOWN";
    if (currency === "UNKNOWN") unknownCurrency++;
    const t = totals[currency] ??= { orders: 0, gross: 0, net: 0 };
    const orderKey = JSON.stringify([r.project_id, r.plataforma, r.external_transaction_id, currency]);
    if (!bump(r) && !orders.has(orderKey)) { t.orders++; orders.add(orderKey); }
    const gross = number(r.valor), net = number(r.valor_liquido);
    t.gross = t.gross === null || gross === null ? null : round(t.gross + gross);
    t.net = t.net === null || net === null ? null : round(t.net + net);
    if (evidence.length < 5) evidence.push({ id: r.id, transaction: r.external_transaction_id, component: bump(r) ? "bump" : "principal", status: r.status, date, currency, gross, net });
  }
  return { totals, missingIdentity, fallbackDates, unknownCurrency, duplicates: rows.length - missingIdentity - components.size, evidence };
}
export function consolidateAds(rows: Row[]) {
  // Never sum Meta direct and Zernio, or campaign totals and ad details.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = JSON.stringify([r.source, r.plataforma, r.moeda, r.data_ref]);
    const group = groups.get(key);
    if (group) group.push(r); else groups.set(key, [r]);
  }
  return [...groups.values()].map(group => {
    const detail = group.filter(r => text(r.ad_id) && !text(r.ad_id).startsWith("CAMP:"));
    // CAMP rows are synthetic zero placeholders in zernio-ads-sync, not collected insights.
    const usable = detail;
    const unique = new Map<string, Row>();
    for (const r of usable) unique.set(JSON.stringify([r.ad_id, r.data_ref]), r);
    const data = [...unique.values()];
    const total = (field: string) => data.length && data.every(r => number(r[field]) !== null) ? round(data.reduce((s, r) => s + (number(r[field]) ?? 0), 0)) : null;
    return { source: text(group[0].source) || "legado", platform: group[0].plataforma, currency: text(group[0].moeda).toUpperCase() || "UNKNOWN", day: group[0].data_ref, spend: total("valor"), views: total("landing_page_views"), checkouts: total("init_checkout"), excluded: group.length - data.length };
  });
}
export function consolidateEvents(rows: Row[]) {
  const originalIds = new Set(rows.filter(r => !r.step).map(r => text(r.id)).filter(Boolean));
  const bridge = (r: Row) => object(r.meta).source === "legacy_events";
  const duplicates = rows.filter(r => bridge(r) && originalIds.has(text(r.event_id).replace(/^legacy_/, "")));
  const duplicateSet = new Set(duplicates);
  const eligible = rows.filter(r => !duplicateSet.has(r)).filter(r => {
    const m = { ...object(r.metadata), ...object(r.event_data), ...object(r.meta) };
    return ![true, "true"].includes(m.validation as boolean | string) && !m.qa_source && ![true, "true"].includes(m.test as boolean | string) && text(r.utm_source).toLowerCase() !== "codex-validation";
  });
  // Preserve original semantics: translated ViewContent/Lead do not prove playback/quiz.
  const name = (r: Row) => bridge(r) ? text(object(r.meta).legacy_event) : text(r.step) || text(r.event_name);
  const sessions = (names: string[]) => new Set(eligible.filter(r => names.includes(name(r))).map(r => text(r.session_id)).filter(Boolean)).size;
  return { pageSessions: sessions(["PageView", "vsl_view", "advertorial_view", "pdp_view"]), checkoutSessions: sessions(["InitiateCheckout", "checkout"]), excluded: rows.length - duplicates.length - eligible.length, bridgeDuplicates: duplicates.length, legacyBridges: rows.filter(bridge).length, missingIdentity: eligible.filter(r => !text(r.session_id) && ["PageView", "InitiateCheckout", "vsl_view", "checkout"].includes(name(r))).length };
}
export type Coverage = "unavailable" | "incomplete" | "missing" | "stale" | "observed" | "confirmed";
export function coverage(input: { error?: boolean; truncated?: boolean; rows: number; lastSuccess?: string | null; complete?: boolean }, now = Date.now()): Coverage {
  if (input.error) return "unavailable";
  if (input.truncated) return "incomplete";
  if (input.lastSuccess && (!Number.isFinite(Date.parse(input.lastSuccess)) || now - Date.parse(input.lastSuccess) > 36 * 3600000)) return "stale";
  if (input.complete) return "confirmed";
  return input.rows ? "observed" : "missing";
}

import { describe, expect, it } from "vitest";
import { loadProjectCycle, recordProjectCycle, type CycleDb } from "@shared/project-cycle-load";

type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>, failures: string[] = []) {
  const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const db = { from(table: string) {
    const filters: Array<[string, unknown]> = [];
    const inFilters: Array<[string, unknown[]]> = [];
    reads.push({ table, filters });
    const result = () => ({ data: (tables[table] ?? []).filter(r => filters.every(([k, v]) => r[k] === v) && inFilters.every(([k, v]) => v.includes(r[k]))), error: failures.includes(table) ? { message: `indisponível: ${table}` } : null });
    const q = {
      select: () => q, order: () => q, limit: () => q, gte: () => q, lt: () => q,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      in: (k: string, v: unknown[]) => { inFilters.push([k, v]); return q; },
      maybeSingle: async () => { const r = result(); return { ...r, data: r.data[0] ?? null }; },
      then: <T,>(resolve: (value: { data: Row[]; error: unknown }) => T) => Promise.resolve(result()).then(resolve),
    };
    return q;
  } } as unknown as CycleDb;
  return { db, reads };
}
const now = new Date("2026-10-11T13:00:00Z");
const readers = { live: async () => ({}), kit: async () => ({ saude_sync_anuncios: { estado: "ok" } }), briefing: async () => ({}) };
const tables = () => ({
  imphq_projects: [{ id: "slimsoda", name: "SlimSoda" }, { id: "powder", name: "Powder" }],
  imphq_project_sites: [{ projeto_id: "slimsoda", site_id: "s", papel: "pdp" }, { projeto_id: "powder", site_id: "other" }],
  imphq_sites: [{ id: "s", titulo: "PDP", url: "https://pdp.test", status: "rascunho" }, { id: "other", url: "https://other.test" }],
  imphq_referencias: [{ id: "r", project_id: "slimsoda" }, { id: "wrong", project_id: "powder" }],
  imphq_activity_log: [{ id: "old", project_id: "slimsoda", action: "project_cycle", details: { cycle: { objective: "Validar oferta" } } }],
});

describe("project cycle real-source loader", () => {
  it("scopes inventories to the exact project and reuses the journal objective", async () => {
    const { db, reads } = database(tables());
    const cycle = await loadProjectCycle(db, "slimsoda", readers, null, now);
    expect(cycle.objective).toBe("Validar oferta");
    expect(cycle.objective_origin).toBe("journal");
    expect(cycle.sources.find(s => s.key === "sites")?.data).toEqual([expect.objectContaining({ id: "s", papel: "pdp" })]);
    expect(JSON.stringify(cycle)).not.toContain("https://other.test");
    expect(cycle.sources.find(s => s.key === "references")?.data).toEqual([{ id: "r", project_id: "slimsoda" }]);
    expect(reads.find(r => r.table === "imphq_project_sites")?.filters).toContainEqual(["projeto_id", "slimsoda"]);
  });
  it("fails closed on a missing project before consulting other sources", async () => {
    const { db, reads } = database(tables());
    await expect(loadProjectCycle(db, "missing", readers, null, now)).rejects.toThrow("Projeto não encontrado");
    expect(reads).toHaveLength(1);
  });
  it("preserves query errors, including incompatible legacy goals IDs", async () => {
    const { db } = database(tables(), ["imphq_project_goals", "imphq_referencias"]);
    const cycle = await loadProjectCycle(db, "slimsoda", readers, "Lançar", now);
    expect(cycle.sources.find(s => s.key === "goals")).toMatchObject({ status: "error", data: null });
    expect(cycle.sources.find(s => s.key === "references")).toMatchObject({ status: "error", data: null });
    expect(cycle.sources.find(s => s.key === "financial_evidence")?.data).toMatchObject({ currency_complete: false, currencies: [] });
  });
  it("marks old Clarity aggregates stale and preserves mixed currencies", async () => {
    const { db } = database({ ...tables(), imphq_metrics_daily: [{ project_id: "slimsoda", source: "clarity", updated_at: "2026-09-01" }],
      imphq_ads_spend: [{ project_id: "slimsoda", data_ref: "2026-10-11", moeda: "USD" }],
      imphq_vendas: [{ project_id: "slimsoda", status: "aprovado", data: { moeda: "BRL" } }] });
    const cycle = await loadProjectCycle(db, "slimsoda", readers, "Validar", now);
    expect(cycle.sources.find(s => s.key === "clarity")?.status).toBe("stale");
    expect(cycle.sources.find(s => s.key === "financial_evidence")?.data).toMatchObject({ currencies: ["USD", "BRL"] });
    expect(cycle.external_actions_executed).toBe(false);
  });
  it("reuses pages in the map and redacts credential fields before producing a durable snapshot", async () => {
    const { db } = database({ ...tables(), imphq_projects: [{ id: "slimsoda", name: "SlimSoda", data: { api_key: "never-persist", produtos: [{ nome: "Original" }, { nome: "Powder" }] } }],
      imphq_project_sites: [], imphq_company_map_nodes: [{ id: "page", linked_project_id: "slimsoda", kind: "pagina_vendas", url: "https://pdp.test" }] });
    const cycle = await loadProjectCycle(db, "slimsoda", readers, "Validar", now);
    expect(cycle.sources.find(s => s.key === "pages")?.data).toEqual([expect.objectContaining({ id: "page", origin: "project_map" })]);
    expect(JSON.stringify(cycle)).not.toContain("never-persist");
    expect(cycle.next_actions.find(a => a.id === "plan_creative_pilot")?.dependencies).toContain("confirm_offer_scope");
  });
});

describe("cycle journal atomic replay", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  const cycle = { project: { id: "p" }, objective: "Validar" };
  it("only inserts once even when concurrent requests reuse the same UUID", async () => {
    const saved = new Map<string, Row>();
    const store = {
      insert: async (row: Row) => { const id = String(row.id); if (saved.has(id)) return { error: { code: "23505" } }; saved.set(id, row); return { error: null }; },
      find: async (id: string) => ({ data: saved.get(id), error: null }),
    };
    const results = await Promise.all([recordProjectCycle(cycle, uuid, "p", store), recordProjectCycle({ ...cycle, objective: "Outro" }, uuid, "p", store)]);
    expect(saved.size).toBe(1);
    expect(results.map(r => r.replay)).toEqual([false, true]);
    expect(results[1].cycle).toEqual(cycle);
    await expect(recordProjectCycle(cycle, uuid, "other", store)).rejects.toThrow("outro contexto");
  });
  it("does not swallow persistence failures or invalid identifiers", async () => {
    const store = { insert: async () => ({ error: { message: "database unavailable" } }), find: async () => ({ data: null, error: null }) };
    await expect(recordProjectCycle(cycle, uuid, "p", store)).rejects.toThrow("database unavailable");
    await expect(recordProjectCycle(cycle, "invalid", "p", store)).rejects.toThrow("UUID");
  });
});

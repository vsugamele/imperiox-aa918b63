import { describe, expect, it } from "vitest";
import { buildProjectCycle, type CycleInput, type CycleSource } from "@shared/project-cycle";

const now = "2026-10-11T15:00:00.000Z";
const source = (key: string, data: unknown, status: CycleSource["status"] = "available"): CycleSource =>
  ({ key, data, status, origin: `db:${key}`, observed_at: now });
const input = (sources: CycleSource[], objective: string | null = "Validar uma venda com atribuição"): CycleInput =>
  ({ project_id: "slimsoda", project_name: "Slim Soda", objective, sources, now });
const live = (revenueSource = "webhook") => ({ parcial: {
  faturamento: { valor: 150, fonte: revenueSource }, gasto: { valor: 50, fonte: "meta" }, cpa: { alvo: 30 },
} });
const finance = (currencies = ["BRL"], complete = true) => ({ currencies, currency_complete: complete,
  sync_health: { estado: "ok" }, period_start: "2026-10-11T03:00:00.000Z", period_end: now });

describe("project cycle evidence and preparation", () => {
  it("prioritizes human objective and prepares only without external execution", () => {
    const result = buildProjectCycle(input([], null));
    expect(result.next_actions[0].id).toBe("define_objective");
    expect(result.completed_actions).toEqual([]);
    expect(result.external_actions_executed).toBe(false);
    expect(result.next_actions.find((action) => action.id === "plan_creative_pilot")?.arguments.modo).toBe("plano");
  });

  it("does not turn query errors or stale records into assertions of missing assets", () => {
    const result = buildProjectCycle(input([source("sites", [], "error"), source("competitors", [], "stale"), source("references", [], "stale")]));
    expect(result.next_actions.some((action) => action.id === "verify_sites")).toBe(false);
    expect(result.next_actions.some((action) => action.id === "research_competitors")).toBe(false);
    expect(result.next_actions.some((action) => action.id === "collect_references")).toBe(false);
    expect(result.next_actions.find((action) => action.id === "refresh_sites")?.reason).toContain("não permite concluir");
    expect(result.next_actions.find((action) => action.id === "plan_creative_pilot")?.dependencies).toContain("refresh_sites");
  });

  it("uses actual empty results to prepare foundations ahead of creative plans", () => {
    const result = buildProjectCycle(input([source("project", { avatar: {} }), source("sites", []), source("competitors", []), source("references", [])]));
    const plan = result.next_actions.find((action) => action.id === "plan_creative_pilot");
    expect(plan?.dependencies).toEqual(expect.arrayContaining(["prepare_avatar", "verify_sites", "research_competitors", "collect_references"]));
    expect(result.next_actions.findIndex((action) => action.id === "prepare_avatar")).toBeLessThan(result.next_actions.findIndex((action) => action.id === "plan_creative_pilot"));
  });

  it("does not claim draft pages, skill metadata or Clarity aggregates are validated evidence", () => {
    const result = buildProjectCycle(input([source("sites", [{ status: "draft", url: "https://example.test" }]),
      source("knowledge", [{ skill_nome: "H&W" }]), source("clarity", [{ scroll_depth: 90 }])]));
    expect(result.next_actions.find((action) => action.id === "verify_sites")?.reason).toContain("não comprovam publicação");
    expect(result.next_actions.find((action) => action.id === "review_knowledge")?.verification).toContain("metadados sozinhos");
    expect(result.next_actions.find((action) => action.id === "review_page_behavior")?.reason).toContain("não equivalem");
  });
});

describe("project cycle financial gates", () => {
  it("recognizes reconciled same-currency measurements without labeling contribution as net profit", () => {
    const result = buildProjectCycle(input([source("live", live()), source("financial_evidence", finance())]));
    expect(result.economics.ready_for_decisions).toBe(true);
    expect(result.economics.revenue_less_ad_spend).toBe(100);
    expect(result.economics.net_profit).toBeNull();
  });

  it.each([{ currencies: ["BRL", "USD"] }, { currencies: [] as string[] }])("blocks combining unknown or mixed currencies $currencies", ({ currencies }) => {
    const result = buildProjectCycle(input([source("live", live()), source("financial_evidence", finance(currencies))]));
    expect(result.economics.ready_for_decisions).toBe(false);
    expect(result.economics.revenue_less_ad_spend).toBeNull();
  });

  it("blocks Meta fallback even when the live panel shows a positive revenue", () => {
    const result = buildProjectCycle(input([source("live", live("meta")), source("financial_evidence", finance())]));
    expect(result.economics.ready_for_decisions).toBe(false);
    expect(result.economics.gaps.join(" ")).toContain("fallback Meta");
  });

  it("blocks missing per-row currency, failed sync, stale evidence and nonpositive target", () => {
    const cases = [finance(["BRL"], false), { ...finance(), sync_health: { estado: "parado" } },
      { ...finance(), period_end: "2026-10-10T15:00:00.000Z" }, { ...finance(), period_end: "2026-10-12T15:00:00.000Z" }];
    for (const financial of cases) {
      expect(buildProjectCycle(input([source("live", live()), source("financial_evidence", financial)])).economics.ready_for_decisions).toBe(false);
    }
    const missingTarget = live();
    missingTarget.parcial.cpa.alvo = 0;
    expect(buildProjectCycle(input([source("live", missingTarget), source("financial_evidence", finance())])).economics.ready_for_decisions).toBe(false);
    expect(buildProjectCycle(input([source("live", live()), source("financial_evidence", finance(), "stale")])).economics.ready_for_decisions).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildMapPath, metricVerdict, parseMetricRule, pathFocus, type PathNode } from "@shared/map-path";

const n = (id: string, kind: string, x: number, y = 0, extra: Partial<PathNode> = {}): PathNode => ({ id, kind, position: { x, y }, ...extra });
const e = (source: string, target: string) => ({ source, target });

// anúncio → página → checkout → compra → obrigado; recuperação sai do checkout; downsell sai da página; análise solta; centro sem número.
const nodes = [
  n("centro", "vertical", -500), n("ads", "anuncio", 0), n("pagina", "pagina_vendas", 300), n("checkout", "checkout", 600),
  n("compra", "compra", 900), n("obrigado", "obrigado", 1200), n("recup", "recuperacao", 700, 400), n("down", "downsell", 400, 400),
  n("analise", "processo", 0, 900), n("organico", "instagram", 0, 300),
];
const edges = [e("centro", "ads"), e("ads", "pagina"), e("organico", "pagina"), e("pagina", "checkout"), e("checkout", "compra"), e("compra", "obrigado"),
  e("checkout", "recup"), e("recup", "checkout"), e("pagina", "down")];

describe("map path", () => {
  it("finds the longest arrow path ending at the purchase, with branches, after-sale and loose steps", () => {
    const p = buildMapPath(nodes, edges);
    expect(p.objetivo).toBe("compra");
    expect(p.principal).toEqual(["ads", "pagina", "checkout", "compra"]);
    expect(p.alternativas.get("checkout")).toEqual(["recup"]);
    expect(p.alternativas.get("pagina")).toEqual(["down"]);
    expect(p.depois).toEqual(["obrigado"]);
    expect(p.fora).toEqual(expect.arrayContaining(["analise", "organico"]));
    expect(p.principal).not.toContain("centro");
  });

  it("applies the manual adjustment", () => {
    const adjusted = nodes.map((x) => (x.id === "organico" ? { ...x, path_role: "principal" } : x.id === "ads" ? { ...x, path_role: "alternativa" } : x));
    const p = buildMapPath(adjusted, edges);
    expect(p.principal).toContain("organico");
    expect(p.principal).not.toContain("ads");
  });

  it("falls back to the checkout and has no main path without purchase or checkout", () => {
    expect(buildMapPath(nodes.filter((x) => x.id !== "compra"), edges).objetivo).toBe("checkout");
    const none = buildMapPath([n("a", "anuncio", 0), n("b", "instagram", 300)], [e("a", "b")]);
    expect(none.principal).toEqual([]);
    expect(none.fora).toEqual(["a", "b"]);
  });

  it("points to the first main step not done, with why", () => {
    const steps = [{ id: "ads", step_status: "done" }, { id: "pagina", step_status: "in_progress", owner_member_id: null, due_date: "2026-10-01" }, { id: "checkout", step_status: "pending" }];
    expect(pathFocus(["ads", "pagina", "checkout"], steps, "2026-10-03")).toEqual({ id: "pagina", motivo: "em andamento · sem dono · atrasada desde 01/10/2026" });
    expect(pathFocus(["ads"], steps, "2026-10-03")).toBeNull();
  });

  it("reads written targets as numeric rules, using the scale params for relative ones", () => {
    const refs = { cpaAlvo: 60, payout: 120, icsPorVenda: 6 };
    expect(parseMetricRule("acima de 80%")).toEqual({ tipo: "min", a: 80 });
    expect(parseMetricRule("referência inicial: 5% a 15% da página de oferta")).toEqual({ tipo: "faixa", a: 5, b: 15 });
    expect(parseMetricRule("35%")).toEqual({ tipo: "min", a: 35 });
    expect(parseMetricRule("até o CPA alvo no dia 3", refs)).toEqual({ tipo: "max", a: 60 });
    expect(parseMetricRule("acima de payout ÷ CPA alvo", refs)).toEqual({ tipo: "min", a: 2 });
    expect(parseMetricRule("até CPA alvo ÷ ICs por venda", refs)).toEqual({ tipo: "max", a: 10 });
    expect(parseMetricRule("até o CPA alvo")).toBeNull();
    expect(parseMetricRule("definir na 1ª semana")).toBeNull();
    expect(parseMetricRule("1 venda a cada 10 a 20 conversas (referência inicial)")).toBeNull();
    expect(parseMetricRule(null)).toBeNull();
  });

  it("colors the real value against the rule", () => {
    expect(metricVerdict(50, { tipo: "max", a: 60 })).toBe("verde");
    expect(metricVerdict(70, { tipo: "max", a: 60 })).toBe("amarelo");
    expect(metricVerdict(90, { tipo: "max", a: 60 })).toBe("vermelho");
    expect(metricVerdict(85, { tipo: "min", a: 80 })).toBe("verde");
    expect(metricVerdict(70, { tipo: "min", a: 80 })).toBe("amarelo");
    expect(metricVerdict(10, { tipo: "faixa", a: 5, b: 15 })).toBe("verde");
    expect(metricVerdict(17, { tipo: "faixa", a: 5, b: 15 })).toBe("amarelo");
    expect(metricVerdict(null, { tipo: "min", a: 1 })).toBe("sem_dado");
    expect(metricVerdict(3, null)).toBe("sem_regua");
  });
});

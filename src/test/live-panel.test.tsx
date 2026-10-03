import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { adsSyncHealth, buildLivePanel, dayFraction, liveDelta, type LiveInput } from "@shared/live-panel";
import { LivePanel } from "@/components/projeto/LivePanel";

const params = { payout: 70, cpaAlvo: 45 };
const full: LiveInput = {
  trackerEvents: { PageView: 600, InitiateCheckout: 180 },
  sales: [
    ...Array.from({ length: 10 }, () => ({ status: "aprovado", valor: 119, data: { moeda: "USD" } })),
    { status: "carrinho_abandonado", valor: 119, data: { moeda: "USD" } },
    { status: "recusado", valor: 119 },
    { status: "pix_gerado", valor: 47 },
    { status: "reembolsado", valor: 119 },
  ],
  ads: [{ valor: 300, landing_page_views: 900, checkouts_iniciados: 0, init_checkout: 200, compras: 11, valor_conversao: 1300, moeda: "USD" }, { valor: 100, compras: 1 }],
  webhookConnected: true,
  params,
  dayFraction: 0.5,
};

describe("painel ao vivo: regra", () => {
  it("prioriza tracker e checkout, e calcula parcial, zona do CPA e ritmo", () => {
    const p = buildLivePanel(full);
    expect(p.moeda).toBe("USD");
    expect(p.funil.etapas.map((e) => [e.key, e.valor, e.fonte])).toEqual([
      ["visitas", 600, "tracker"], ["checkout_iniciado", 180, "tracker"], ["checkout_preenchido", 14, "webhook"], ["pedidos", 10, "webhook"],
    ]);
    expect(p.funil.conversoes.map((c) => c.taxa)).toEqual([30, 7.78, 71.43]);
    expect(p.parcial).toMatchObject({
      gasto: { valor: 400, fonte: "meta" }, faturamento: { valor: 1190, fonte: "webhook" }, vendas: { valor: 10 },
      cpa: { valor: 40, zona: "escala", zona_label: "ESCALA", alvo: 45 }, roas: { valor: 2.98 }, lucro: { valor: 790 }, ticket: { valor: 119 },
    });
    expect(p.pendentes).toEqual({ quantidade: 1, valor: 47 });
    expect(p.reembolsos).toEqual({ quantidade: 1, valor: 119 });
    expect(p.ritmo).toMatchObject({ vendas_por_hora: 0.83, projecao_vendas: 20, projecao_faturamento: 2380, projecao_gasto: 800 });
    expect(p.alertas).toEqual([]);
  });

  it("sem tracker e sem webhook, usa a Meta e avisa", () => {
    const p = buildLivePanel({ ...full, trackerEvents: {}, sales: [], webhookConnected: false });
    expect(p.funil.etapas.map((e) => [e.key, e.valor, e.fonte])).toEqual([["visitas", 900, "meta"], ["checkout_iniciado", 200, "meta"], ["pedidos", 12, "meta"]]);
    expect(p.parcial.faturamento).toEqual({ valor: 1300, fonte: "meta" });
    expect(p.funil.etapas[1].valor).toBe(200);
    expect(p.alertas).toHaveLength(2);
  });

  it("sem nenhuma fonte, não inventa número", () => {
    const p = buildLivePanel({ trackerEvents: {}, sales: [], ads: [], webhookConnected: false, dayFraction: 0.3 });
    expect(p.funil.etapas).toEqual([]);
    expect(p.parcial.gasto).toEqual({ valor: null, fonte: null });
    expect(p.parcial.cpa.valor).toBeNull();
    expect(p.moeda).toBe("BRL");
    expect(p.alertas).toHaveLength(3);
  });

  it("avisa quando pixel e checkout discordam mais de 20%", () => {
    const p = buildLivePanel({ ...full, ads: [{ valor: 400, compras: 20 }] });
    expect(p.alertas[0]).toMatch(/Pixel da Meta \(20\) e checkout \(10\)/);
    // O card de vendas mostra os dois números.
    expect(p.parcial.vendas).toMatchObject({ valor: 10, fonte: "webhook", outra: { valor: 20, fonte: "meta" } });
  });

  it("variação entre leituras e fração do dia em Brasília", () => {
    const a = buildLivePanel(full);
    const b = buildLivePanel({ ...full, sales: full.sales.slice(1) });
    expect(liveDelta(a, b)).toMatchObject({ vendas: 1, faturamento: 119 });
    expect(liveDelta(a, null)).toBeNull();
    expect(dayFraction(new Date("2026-10-03T15:00:00Z"))).toBe(0.5);
  });
});

describe("saúde do sync de anúncios", () => {
  const now = Date.parse("2026-10-03T20:00:00Z");
  it("token expirado da Meta vira instrução, com o último dia de gasto", () => {
    const h = adsSyncHealth({ meta_configurado: true, meta_status: "error", meta_erro_codigo: "190", meta_ultimo_sync: "2026-06-26T17:30:08Z", ultimo_dia_com_gasto: "2026-07-16" }, now);
    expect(h).toEqual({ estado: "erro", problemas: [
      "Token da Meta expirado (último sync ok em 26/06): gerar token novo de usuário do sistema no Business Manager.",
      "Último dia com gasto registrado: 16/07.",
    ] });
  });

  it("parado, ok e sem conta", () => {
    expect(adsSyncHealth({ meta_configurado: true, meta_status: "ok", meta_ultimo_sync: "2026-09-30T00:00:00Z" }, now)).toEqual({ estado: "parado", problemas: ["Sync da Meta parado desde 30/09."] });
    expect(adsSyncHealth({ meta_configurado: true, meta_status: "ok", meta_ultimo_sync: "2026-10-03T19:30:00Z" }, now)).toEqual({ estado: "ok", problemas: [] });
    expect(adsSyncHealth(null, now).estado).toBe("sem_config");
  });

  it("no painel, o motivo do sync substitui o aviso genérico de gasto", () => {
    const p = buildLivePanel({ ...full, ads: [], syncHealth: { estado: "erro", problemas: ["Token da Meta expirado."] } });
    expect(p.alertas).toContain("Token da Meta expirado.");
    expect(p.alertas.some((a) => a.startsWith("Sem gasto"))).toBe(false);
  });
});

const panel = buildLivePanel(full);
vi.mock("@/hooks/useLivePanel", () => ({
  useLivePanel: () => ({ data: panel, isLoading: false, error: null, dataUpdatedAt: Date.parse("2026-10-03T15:00:00Z"), comparison: { delta: { vendas: 2, gasto: 50, faturamento: 238, cpa: -1, roas: 0.1, lucro: 188 }, at: Date.parse("2026-10-03T14:45:00Z") } }),
}));

describe("painel ao vivo: tela", () => {
  it("mostra funil, parcial com fonte, zona do CPA, variação e ritmo", () => {
    render(<LivePanel projectId="p" />);
    expect(screen.getByText("Ao vivo · hoje")).toBeInTheDocument();
    expect(screen.getByText("Checkout preenchido")).toBeInTheDocument();
    expect(screen.getByText("71.43% →")).toBeInTheDocument();
    expect(screen.getByText("ESCALA")).toBeInTheDocument();
    expect(screen.getByText(/variação vs/)).toBeInTheDocument();
    expect(screen.getByText(/dia ≈ 20 vendas/)).toBeInTheDocument();
    expect(screen.getAllByText("checkout").length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { adMatchesContent, adStats, contentKey, trafficPlan, type AdDayRow, type AdSale } from "@shared/traffic-agent";

const p = { payout: 47, cpaAlvo: 25 };
const row = (ad: string, nome: string, dia: string, valor: number, extra: Partial<AdDayRow> = {}): AdDayRow =>
  ({ ad_id: ad, anuncio: nome, campanha: "[JP][CCP] Teste", valor, compras: 0, init_checkout: 0, link_clicks: 0, effective_status: "ACTIVE", data_ref: dia, ...extra });
const sale = (content: string): AdSale => ({ utm_campaign: "ccp-teste-angulos-0510", utm_content: content, status: "aprovado" });

describe("agente de tráfego: venda por anúncio", () => {
  it("liga a UTM de conteúdo ao nome do anúncio pelo número e pela palavra", () => {
    expect(contentKey("07-publico::PAZXh0bgNhZW0")).toBe("07-publico");
    expect(adMatchesContent("CCP 07 publico — Crespos, cacheados", "07-publico")).toBe(true);
    expect(adMatchesContent("CCP 17 publico — outro", "07-publico")).toBe(false);
    expect(adMatchesContent("CCP 07 medo", "07-publico")).toBe(false);
    expect(adMatchesContent("Qualquer", "link_in_bio")).toBe(false);
  });

  it("soma 7 dias por anúncio, usa UTM quando casa e pixel quando não, ignora linha de campanha", () => {
    const stats = adStats([
      row("a7", "CCP 07 publico", "2026-10-05", 30), row("a7", "CCP 07 publico", "2026-10-06", 20, { compras: 1 }),
      row("a2", "CCP 02 dinheiro", "2026-10-06", 15, { compras: 2 }),
      row("CAMP:x", "", "2026-10-06", 99),
    ], [sale("07-publico::abc"), sale("07-publico::def"), sale("05-mecanismo"), { ...sale("07-publico"), status: "pendente" }], "2026-10-07");
    expect(stats.map((s) => [s.ad_id, s.gasto, s.vendas, s.fonte_vendas, s.dias_sem_gastar])).toEqual([
      ["a7", 50, 2, "utm", 1],
      ["a2", 15, 2, "pixel", 1],
    ]);
  });
});

describe("agente de tráfego: decisões", () => {
  const stats = adStats([
    row("morto", "CCP 01 medo", "2026-10-06", 80),                         // 80 ≥ 3×25, zero venda → pausa sozinho
    row("caro", "CCP 04 bloqueio", "2026-10-06", 60),                      // 60 ≥ 2×25, zero venda → proposta
    row("prej", "CCP 03 status", "2026-10-06", 100, { compras: 1 }),       // CPA 100 > payout 47 → proposta
    row("top", "CCP 07 publico", "2026-10-06", 60, { compras: 4 }),        // CPA 15 ≤ 25 com 4 vendas → escalar
    row("magro", "CCP 02 dinheiro", "2026-10-06", 80, { compras: 2 }),     // CPA 40: entre 80% do payout (37,6) e 47 → observar
    row("novo", "CCP 08 autoridade", "2026-10-06", 20),                    // abaixo de 2× → manter
    row("pausado", "CCP 05 mecanismo", "2026-10-06", 90, { effective_status: "PAUSED" }),
  ], [], "2026-10-07");
  const plan = trafficPlan(stats, p);
  const acao = (id: string) => plan.decisoes.find((d) => d.ad_id === id)?.acao;

  it("pausa sozinho só prejuízo claro e propõe o meio-termo", () => {
    expect(acao("morto")).toBe("pausar_auto");
    expect(acao("caro")).toBe("pausar");
    expect(acao("prej")).toBe("pausar");
    expect(acao("top")).toBe("escalar");
    expect(acao("magro")).toBe("observar");
    expect(acao("novo")).toBe("manter");
    expect(acao("pausado")).toBeUndefined();
    expect(plan.resumo).toMatchObject({ pausar_auto: 1, propostas: 2, escalar: 1 });
  });

  it("ranqueia ofensores pelo desperdício além do CPA alvo e sugere alternativas a partir do vencedor", () => {
    expect(plan.ofensores.map((o) => [o.ad_id, o.desperdicio])).toEqual([["pausado", 90], ["morto", 80], ["prej", 75]]);
    expect(plan.alternativas.map((a) => [a.tipo, a.ad_id])).toEqual([["duplicar_vencedor", "top"], ["variacoes_do_vencedor", "top"]]);
  });

  it("sem vencedor, sugere ângulos novos", () => {
    const semVencedor = trafficPlan(adStats([row("x", "CCP 01 medo", "2026-10-06", 40)], [], "2026-10-07"), p);
    expect(semVencedor.alternativas.map((a) => a.tipo)).toEqual(["angulos_novos"]);
  });
});

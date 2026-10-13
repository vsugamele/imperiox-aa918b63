import { describe, expect, it } from "vitest";
import { buildFunnelLive } from "@shared/funnel-live";
import { runFunnelDiagnostics, classifyNodeTemperature, simulateFunnelImpact } from "@shared/funnel-diagnostics";

describe("motor de diagnósticos cruzados do funil", () => {
  it("detecta vazamento crítico entre anúncio e página (lentidão de carregamento)", () => {
    // 200 cliques, mas apenas 60 visitas na página (30% de chegada vs ref 70%)
    const ads = [{ spend: 200, impressoes: 10000, link_clicks: 200 }];
    const pages = [{ url: "https://site.com/vsl", values: { sessoes_pagina: 60, cliques_cta: 5 } }];
    const sales: any[] = [];

    const f = buildFunnelLive({ ads, pages, sales });
    const report = runFunnelDiagnostics(f);

    expect(report.diagnostics.length).toBeGreaterThan(0);
    const speedDiag = report.diagnostics.find((d) => d.id === "ads-to-page-speed");
    expect(speedDiag).toBeDefined();
    expect(speedDiag?.severity).toBe("critico");
    expect(speedDiag?.badge).toContain("Velocidade da Página");
    expect(speedDiag?.rootCause).toContain("abandonaram no caminho");
    expect(report.score).toBeLessThan(80);
  });

  it("detecta gargalo de retenção de VSL quando visitas são altas mas início de checkout é baixo", () => {
    // 1000 visitas na página, mas apenas 15 checkouts iniciados (1.5% vs ref 8%)
    const ads = [{ spend: 500, impressoes: 50000, link_clicks: 1200 }];
    const pages = [{ url: "https://site.com/vsl", values: { sessoes_pagina: 1000, cliques_cta: 15 } }];
    const sales: any[] = [];

    const f = buildFunnelLive({ ads, pages, sales });
    const report = runFunnelDiagnostics(f);

    const vslDiag = report.diagnostics.find((d) => d.id === "page-to-checkout-vsl");
    expect(vslDiag).toBeDefined();
    expect(vslDiag?.severity).toBe("critico");
    expect(vslDiag?.badge).toContain("Retenção da VSL");
  });

  it("detecta oportunidade de escala quando a página converte muito bem", () => {
    // 100 visitas e 14 checkouts iniciados (14% início de checkout!), 7 vendas aprovadas
    const ads = [{ spend: 80, impressoes: 10000, link_clicks: 120 }];
    const pages = [{ url: "https://site.com/vsl", values: { sessoes_pagina: 100, cliques_cta: 14 } }];
    const sales = [
      { status: "aprovado", valor: 47, tipo_venda: "principal" },
      { status: "aprovado", valor: 47, tipo_venda: "principal" },
      { status: "aprovado", valor: 47, tipo_venda: "principal" },
      { status: "aprovado", valor: 47, tipo_venda: "principal" },
      { status: "aprovado", valor: 47, tipo_venda: "principal" },
      { status: "aprovado", valor: 47, tipo_venda: "principal" },
      { status: "aprovado", valor: 47, tipo_venda: "principal" },
    ];

    const f = buildFunnelLive({ ads, pages, sales });
    const report = runFunnelDiagnostics(f);

    const scaleDiag = report.diagnostics.find((d) => d.id === "scale-opportunity-high-conversion");
    expect(scaleDiag).toBeDefined();
    expect(scaleDiag?.severity).toBe("oportunidade");
  });

  it("classifica a temperatura das etapas com precisão", () => {
    expect(classifyNodeTemperature("meta_ads", null, "Criativo 01").temp).toBe("frio");
    expect(classifyNodeTemperature("vsl", "Apresentação da Tese", "Vídeo de Vendas").temp).toBe("morno");
    expect(classifyNodeTemperature("checkout", "Pagamento", "Checkout Ticto").temp).toBe("quente");
    expect(classifyNodeTemperature("orderbump", "Oferta", "Bump 1").temp).toBe("quente");
    expect(classifyNodeTemperature("whatsapp", "Recuperação", "Disparo Pix").temp).toBe("retencao");
    expect(classifyNodeTemperature("supabase", "Infra", "Banco de dados").temp).toBe("operacao");
  });

  it("simula o impacto financeiro (What-If) de otimizar a velocidade da página", () => {
    // 100 cliques, 35 visitas (35% chegada), 5 vendas (R$ 500 faturamento), R$ 200 de gasto
    const ads = [{ spend: 200, impressoes: 5000, link_clicks: 100 }];
    const pages = [{ url: "https://site.com/vsl", values: { sessoes_pagina: 35, cliques_cta: 5 } }];
    const sales = [
      { status: "aprovado", valor: 100, tipo_venda: "principal" },
      { status: "aprovado", valor: 100, tipo_venda: "principal" },
      { status: "aprovado", valor: 100, tipo_venda: "principal" },
      { status: "aprovado", valor: 100, tipo_venda: "principal" },
      { status: "aprovado", valor: 100, tipo_venda: "principal" },
    ];

    const f = buildFunnelLive({ ads, pages, sales });
    // Simular que a chegada sobe de 35% para 70% (o dobro!)
    const sim = simulateFunnelImpact(f, "chegada", 70);

    expect(sim.currentRate).toBe(35);
    expect(sim.simulatedRate).toBe(70);
    expect(sim.simulatedSales).toBeGreaterThan(sim.currentSales);
    expect(sim.deltaRevenue).toBeGreaterThan(0);
    expect(sim.simulatedRoas).toBeGreaterThan(sim.currentRoas ?? 0);
    expect(sim.simulatedCpa).toBeLessThan(sim.currentCpa ?? 999);
    expect(sim.actionPlan.length).toBe(3);
  });

  it("simula o efeito composto de alavancagem em todas as etapas", () => {
    const ads = [{ spend: 300, impressoes: 10000, link_clicks: 200 }];
    const pages = [{ url: "https://site.com", values: { sessoes_pagina: 140, cliques_cta: 20 } }];
    const sales = [{ status: "aprovado", valor: 97, tipo_venda: "principal" }];

    const f = buildFunnelLive({ ads, pages, sales });
    const sim = simulateFunnelImpact(f, "composto", 100, 15);

    expect(sim.stage).toBe("composto");
    expect(sim.simulatedSales).toBeGreaterThanOrEqual(1);
    expect(sim.actionPlan).toBeDefined();
  });
});

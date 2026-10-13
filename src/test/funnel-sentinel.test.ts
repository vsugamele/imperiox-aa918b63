import { describe, expect, it } from "vitest";
import { buildFunnelLive } from "@shared/funnel-live";
import { scanFunnelAnomalies } from "@shared/funnel-sentinel";

describe("Sentinela de Vazamento Proativo (funnel-sentinel)", () => {
  it("detecta vazamento crítico de PageSpeed quando cliques são altos e chegada é baixa", () => {
    const funnel = buildFunnelLive({
      ads: [{ spend: 300, link_clicks: 200 }],
      pages: [{ url: "https://site.com/vsl", values: { sessoes_pagina: 60 } }], // chegada 30% (< 48%)
      sales: [],
    });

    const report = scanFunnelAnomalies(funnel, "proj_test");
    expect(report.status).toBe("critico");
    expect(report.activeAnomalies.length).toBeGreaterThanOrEqual(1);

    const pagespeedAnomaly = report.activeAnomalies.find((a) => a.type === "queda_chegada_pagespeed");
    expect(pagespeedAnomaly).toBeDefined();
    expect(pagespeedAnomaly?.stageId).toBe("pagina");
    expect(pagespeedAnomaly?.impactBrlEstimate).toBeGreaterThan(0);
    expect(pagespeedAnomaly?.playbookType).toBe("pagespeed");
  });

  it("detecta pico de recusa no gateway quando aprovação cai abaixo de 36%", () => {
    const funnel = buildFunnelLive({
      ads: [{ spend: 100 }],
      pages: [],
      // 10 pedidos gerados, apenas 2 aprovados (20% < 36%)
      sales: [
        { status: "aprovado", valor: 100, tipo_venda: "principal" },
        { status: "aprovado", valor: 100, tipo_venda: "principal" },
        ...Array.from({ length: 8 }).map(() => ({ status: "recusado", valor: 100, tipo_venda: "principal" })),
      ],
    });

    const report = scanFunnelAnomalies(funnel, "proj_test");
    const gatewayAnomaly = report.activeAnomalies.find((a) => a.type === "recusa_gateway_checkout");
    expect(gatewayAnomaly).toBeDefined();
    expect(gatewayAnomaly?.severity).toBe("critica");
    expect(gatewayAnomaly?.impactBrlEstimate).toBeGreaterThan(0);
    expect(gatewayAnomaly?.playbookType).toBe("checkout_friction");
  });

  it("detecta surto de CPA quando o custo por aquisição extrapola a referência", () => {
    const funnel = buildFunnelLive({
      ads: [{ spend: 500 }],
      pages: [],
      sales: [{ status: "aprovado", valor: 97, tipo_venda: "principal" }], // 1 venda para R$ 500 gasto = CPA R$ 500
    });

    const report = scanFunnelAnomalies(funnel, "proj_test");
    const cpaAnomaly = report.activeAnomalies.find((a) => a.type === "surto_cpa_fatiga");
    expect(cpaAnomaly).toBeDefined();
    expect(cpaAnomaly?.severity).toBe("critica");
    expect(cpaAnomaly?.metricCurrent).toBe(500);
  });

  it("retorna status seguro quando todas as etapas estão saudáveis", () => {
    const funnel = buildFunnelLive({
      ads: [{ spend: 100, impressoes: 10000, link_clicks: 200 }], // CTR 2%
      pages: [{ url: "https://lp.com", values: { sessoes_pagina: 160, cliques_cta: 30 } }], // Chegada 80% (saudável)
      sales: [
        // 6 pedidos gerados, 5 aprovados (83% aprovação)
        { status: "aprovado", valor: 97, tipo_venda: "principal" },
        { status: "aprovado", valor: 97, tipo_venda: "principal" },
        { status: "aprovado", valor: 97, tipo_venda: "principal" },
        { status: "aprovado", valor: 97, tipo_venda: "principal" },
        { status: "aprovado", valor: 97, tipo_venda: "principal" },
        { status: "recusado", valor: 97, tipo_venda: "principal" },
      ],
    });

    const report = scanFunnelAnomalies(funnel, "proj_test");
    expect(report.status).toBe("seguro");
    expect(report.criticalCount).toBe(0);
    expect(report.activeAnomalies.length).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { buildFunnelLive, inferFunnelArchetype } from "@shared/funnel-live";
import {
  scanFunnelAnomalies,
  buildKanbanCardFromDiagnostic,
  generateAntiFatigueHooks,
  calculateSafeScaleProtocol,
  createInterventionSnapshot,
  evaluateInterventionImpact,
  mapBottleneckToProjectTab,
} from "@shared/funnel-sentinel";
import { evaluateProjectExecutiveHealth } from "@/components/projeto/SemaforoProjetos";
import { resolveVisualPreviewForNode } from "@/components/funis/MapNodeVisualPreview";
import type { Tables } from "@/integrations/supabase/types";

describe("Sentinela de Vazamento Proativo & Motores de Execução (funnel-sentinel)", () => {
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

  it("Item 1: avalia a saúde executiva de múltiplos projetos com telemetria real (SemaforoProjetos)", () => {
    const mockProject = {
      id: "linfaflow",
      name: "LinfaFlow",
      category: "DTC Nutra",
      icon: "💧",
      avatar: { nome: "Helena 45+" },
      data: { checkout_url: "https://pay.linfaflow.com", links: ["https://linfaflow.com"] },
    } as unknown as Tables<"imphq_projects">;

    // Cenário com vazamento severo (R$ 400 gastos, 0 vendas)
    const redHealth = evaluateProjectExecutiveHealth(
      mockProject,
      [{ spend: 400, impressoes: 20000, link_clicks: 300 }],
      []
    );
    expect(redHealth.hasLiveTraffic).toBe(true);
    expect(redHealth.statusColor).toBe("red");
    expect(redHealth.gasto).toBe(400);

    // Cenário saudável com ROAS alto
    const greenHealth = evaluateProjectExecutiveHealth(
      mockProject,
      [{ spend: 100, impressoes: 10000, link_clicks: 250, init_checkout: 25 }],
      [
        { status: "aprovado", valor: 197, valor_liquido: 180, tipo_venda: "principal" },
        { status: "aprovado", valor: 197, valor_liquido: 180, tipo_venda: "principal" },
      ]
    );
    expect(greenHealth.hasLiveTraffic).toBe(true);
    expect(greenHealth.bruto).toBe(394);
    expect(greenHealth.roas).toBeGreaterThan(3);
  });

  it("Item 2: constrói payload completo de card do Kanban a partir de um diagnóstico", () => {
    const card = buildKanbanCardFromDiagnostic(
      {
        id: "diag-pagespeed",
        severity: "critico",
        stagePair: ["anuncio", "pagina"],
        title: "Queda severa de chegada na Landing Page",
        badge: "PageSpeed Crítico",
        metricComparison: "32% vs 70% ref",
        rootCause: "Imagens pesadas e scripts bloqueando renderização mobile.",
        recommendation: "Converter assets para WebP e adiar GTM.",
        action: { type: "pagespeed", label: "Otimizar PageSpeed", hint: "" },
        estimatedLeak: "R$ 450/dia",
      },
      "proj_alpha",
      "Projeto Alpha"
    );

    expect(card.priority).toBe("urgent");
    expect(card.project_id).toBe("proj_alpha");
    expect(card.board).toBe("operacional");
    expect(card.ai_generated).toBe(true);
    expect(card.title).toContain("PAGESPEED CRÍTICO");
    expect(card.description).toContain("WebP");
    expect(card.description).toContain("R$ 450/dia");
    expect(card.tags).toContain("pagespeed");
  });

  it("Item 4: gera 5 ganchos anti-fadiga (P1 a P5) ancorados no Avatar e Mecanismo Único", () => {
    const hooks = generateAntiFatigueHooks({
      projectName: "LinfaFlow",
      avatarNome: "Maria",
      dorPrincipal: "inchaço nas pernas ao final do dia",
      desejoPrincipal: "desinchar de forma natural",
      mecanismoNome: "Drenagem Celular Ativa",
    });

    expect(hooks).toHaveLength(5);
    expect(hooks.map((h) => h.code)).toEqual(["P1", "P2", "P3", "P4", "P5"]);
    expect(hooks[0].hook0to3s).toContain("inchaço nas pernas ao final do dia");
    expect(hooks[1].hook0to3s).toContain("Drenagem Celular Ativa");
    expect(hooks[2].primaryTextFirstLine).toContain("LinfaFlow");
  });

  it("Item 5: calcula o protocolo de escala segura (verde vs bloqueado)", () => {
    // Funil saudável e lucrativo -> Escala liberada
    const healthyFunnel = buildFunnelLive({
      ads: [{ spend: 700, impressoes: 50000, link_clicks: 1000 }],
      pages: [{ url: "https://lp.com", values: { sessoes_pagina: 800, cliques_cta: 120 } }],
      sales: Array.from({ length: 18 }).map(() => ({
        status: "aprovado",
        valor: 100,
        valor_liquido: 90,
        tipo_venda: "principal",
      })),
    });

    const greenProtocol = calculateSafeScaleProtocol(healthyFunnel, 7);
    expect(greenProtocol.isScaleReady).toBe(true);
    expect(greenProtocol.currentDailySpend).toBe(100);
    expect(greenProtocol.recommendedDailySpend).toBeGreaterThan(100);
    expect(greenProtocol.budgetIncreasePct).toBeGreaterThanOrEqual(20);
    expect(greenProtocol.cpaCeilingBreaker).toBeGreaterThan(0);

    // Funil com prejuízo/vazamento -> Trava preventiva ativa
    const leakyFunnel = buildFunnelLive({
      ads: [{ spend: 700, link_clicks: 200 }],
      pages: [{ url: "https://lp.com", values: { sessoes_pagina: 40 } }],
      sales: [],
    });

    const lockedProtocol = calculateSafeScaleProtocol(leakyFunnel, 7);
    expect(lockedProtocol.isScaleReady).toBe(false);
    expect(lockedProtocol.scaleTier).toBe("bloqueado");
    expect(lockedProtocol.blockReason).toBeDefined();
  });

  it("Fase 3.1: infere arquétipo corretamente e calcula tendência temporal (deltaPp) vs. período anterior", () => {
    expect(inferFunnelArchetype("Nutra / Suplemento", "LinfaFlow")).toBe("dtc_nutra_pdp");
    expect(inferFunnelArchetype("Mentoria High Ticket", "Mentoria Elite")).toBe("high_ticket");
    expect(inferFunnelArchetype("Infoproduto", "Protocolo VSL")).toBe("low_ticket_vsl");

    const funnel = buildFunnelLive({
      archetype: "dtc_nutra_pdp",
      ads: [{ spend: 200, impressoes: 10000, link_clicks: 300 }], // CTR 3.0%
      pages: [{ url: "https://nutra.com", values: { sessoes_pagina: 240 } }], // Chegada 80%
      sales: [{ status: "aprovado", valor: 197, tipo_venda: "principal" }],
      prevAds: [{ spend: 200, impressoes: 10000, link_clicks: 150 }], // Prev CTR 1.5%
      prevPages: [{ url: "https://nutra.com", values: { sessoes_pagina: 90 } }], // Prev Chegada 60%
      prevSales: [{ status: "aprovado", valor: 97, tipo_venda: "principal" }],
    });

    expect(funnel.archetype).toBe("dtc_nutra_pdp");
    const anuncioStage = funnel.etapas.find((e) => e.id === "anuncio");
    expect(anuncioStage?.conversao?.value).toBe(3);
    expect(anuncioStage?.conversao?.prevValue).toBe(1.5);
    expect(anuncioStage?.conversao?.deltaPp).toBe(1.5);
    expect(anuncioStage?.conversao?.trend).toBe("up");
    expect(funnel.totais.brutoDeltaPct).toBeGreaterThan(0);
  });

  it("Fase 3.2: calcula métricas do Radar de CX (cartão recusado recuperável via PIX e reembolsos)", () => {
    const funnel = buildFunnelLive({
      ads: [{ spend: 100 }],
      pages: [],
      sales: [
        { status: "aprovado", valor: 150, tipo_venda: "principal" },
        { status: "aprovado", valor: 150, tipo_venda: "principal" },
        { status: "recusado", valor: 150, tipo_venda: "principal" },
        { status: "negado", valor: 150, tipo_venda: "principal" },
        { status: "reembolsado", valor: 150, tipo_venda: "principal" },
      ],
    });

    expect(funnel.cx.recusadasCartaoCount).toBe(2);
    expect(funnel.cx.valorRecusadoRecuperavel).toBe(300);
    expect(funnel.cx.reembolsadasCount).toBe(1);
    expect(funnel.cx.valorReembolsado).toBe(150);
    expect(funnel.cx.taxaReembolsoPct).toBeGreaterThan(10);
    expect(funnel.cx.cxStatus).toBe("critico");
  });

  it("Fase 3.4: registra snapshot de intervenção e calcula evolução Antes vs. Depois", () => {
    const beforeFunnel = buildFunnelLive({
      ads: [{ spend: 500, link_clicks: 200 }],
      pages: [{ url: "https://lp.com", values: { sessoes_pagina: 80 } }], // 40% chegada
      sales: [{ status: "aprovado", valor: 250, tipo_venda: "principal" }], // ROAS 0.5x
    });

    const snapshot = createInterventionSnapshot(beforeFunnel, {
      projectId: "proj_1",
      stageId: "pagina",
      actionType: "pagespeed",
      title: "Otimização de WebP + Defer GTM",
    });

    const afterFunnel = buildFunnelLive({
      ads: [{ spend: 500, link_clicks: 200 }],
      pages: [{ url: "https://lp.com", values: { sessoes_pagina: 160 } }], // 80% chegada (+40pp)
      sales: [
        { status: "aprovado", valor: 500, tipo_venda: "principal" },
        { status: "aprovado", valor: 500, tipo_venda: "principal" },
      ], // ROAS 2.0x (+1.5x)
    });

    const evaluation = evaluateInterventionImpact(snapshot, afterFunnel);
    expect(evaluation.verdict).toBe("positivo");
    expect(evaluation.deltaVal).toBe(40);
    expect(evaluation.beforeVal).toBe(40);
    expect(evaluation.afterVal).toBe(80);
  });

  it("Fase 3.5: mapeia o gargalo ativo para o Pilar e Aba prioritária do projeto", () => {
    const leakyPageFunnel = buildFunnelLive({
      ads: [{ spend: 300, impressoes: 15000, link_clicks: 300 }],
      pages: [{ url: "https://lp.com", values: { sessoes_pagina: 90 } }], // chegada 30% -> gargalo em pagina
      sales: [],
    });

    const priority = mapBottleneckToProjectTab(leakyPageFunnel);
    expect(priority).not.toBeNull();
    expect(priority?.pillarId).toBe("infra");
    expect(priority?.tabValue).toBe("sites");
    expect(priority?.severity).toBe("critico");
  });

  it("Fase 4: resolve corretamente a imagem visual gerada ou print ao vivo para cada etapa do mapa", () => {
    const adsPreview = resolveVisualPreviewForNode("anuncio", "Meta Ads Criativo P1");
    expect(adsPreview.archetype).toBe("ads");
    expect(adsPreview.fallbackUrl).toBe("/map-previews/stage-ads.png");
    expect(adsPreview.isLiveScreenshot).toBe(false);

    const vslLive = resolveVisualPreviewForNode("pagina", "VSL Principal", "https://linfaflow.com.br/vsl");
    expect(vslLive.archetype).toBe("vsl");
    expect(vslLive.fallbackUrl).toBe("/map-previews/stage-vsl.png");
    expect(vslLive.isLiveScreenshot).toBe(true);
    expect(vslLive.imageUrl).toContain("api.microlink.io");

    const checkoutPreview = resolveVisualPreviewForNode("checkout", "Checkout Kiwify PIX");
    expect(checkoutPreview.archetype).toBe("checkout");
    expect(checkoutPreview.fallbackUrl).toBe("/map-previews/stage-checkout.png");

    const waPreview = resolveVisualPreviewForNode("recuperacao", "WhatsApp IA Recuperação X1");
    expect(waPreview.archetype).toBe("whatsapp");
    expect(waPreview.fallbackUrl).toBe("/map-previews/stage-whatsapp.png");
  });
});


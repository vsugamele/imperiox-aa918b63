// Sentinela de Vazamento Proativo do Funil (FUN1.4 / SENTINEL).
// Motor analítico autônomo que monitora desvios, quedas de taxas, surtos de CPA e
// falhas de checkout/gateway, estimando o valor financeiro do vazamento em tempo real.
// TS puro, compartilhado entre frontend, edge functions e MCP.

import type { FunnelLive, StageId } from "./funnel-live";
import { REFERENCIA } from "./funnel-live";
import type { ActionType } from "./funnel-diagnostics";

export type AnomalyType =
  | "queda_chegada_pagespeed"
  | "surto_cpa_fatiga"
  | "recusa_gateway_checkout"
  | "queda_retencao_vsl"
  | "silencio_whatsapp_recuperacao"
  | "discrepancia_pixel_medicao";

export type AnomalySeverity = "critica" | "alta" | "media";

export interface FunnelAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  stageId: StageId;
  title: string;
  badge: string;
  metricCurrent: number;
  metricBaseline: number;
  unit: "%" | "brl" | "qty";
  dropPct: number; // % de desvio em relação à referência
  triggerDescription: string;
  impactBrlEstimate: number; // valor monetário estimado em risco/desperdiçado
  actionSuggestion: string;
  playbookType: ActionType;
  detectedAt: string;
}

export interface SentinelReport {
  projectId?: string;
  monitoredAt: string;
  activeAnomalies: FunnelAnomaly[];
  criticalCount: number;
  totalLeakEstimateBrl: number;
  status: "seguro" | "alerta" | "critico";
}

const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Analisa o funil ao vivo e detecta vazamentos proativos e anomalias operacionais.
 */
export function scanFunnelAnomalies(funnel: FunnelLive, projectId?: string): SentinelReport {
  const anomalies: FunnelAnomaly[] = [];
  const nowIso = new Date().toISOString();

  const stageMap = new Map(funnel.etapas.map((e) => [e.id, e]));
  const anuncio = stageMap.get("anuncio");
  const pagina = stageMap.get("pagina");
  const checkout = stageMap.get("checkout");
  const venda = stageMap.get("venda");
  const recuperacao = stageMap.get("recuperacao");

  // Métricas do anúncio
  const spend = anuncio?.metrics.find((m) => m.label === "Gasto")?.value ?? 0;
  const clicks = anuncio?.metrics.find((m) => m.label === "Cliques")?.value ?? 0;
  const cpc = anuncio?.metrics.find((m) => m.label === "CPC")?.value ?? 1.5;

  // Métricas da página
  const visits = pagina?.metrics.find((m) => m.label === "Visitas")?.value ?? 0;
  const chegada = pagina?.conversao?.value ?? null;

  // Métricas do checkout
  const checkoutsInit = checkout?.metrics.find((m) => m.label === "Checkouts iniciados")?.value ?? 0;
  const pedidos = checkout?.metrics.find((m) => m.label === "Pedidos gerados")?.value ?? 0;
  const inicioCheckout = checkout?.conversao?.value ?? null;

  // Métricas de venda
  const vendasNum = venda?.metrics.find((m) => m.label === "Vendas")?.value ?? 0;
  const faturamento = venda?.metrics.find((m) => m.label === "Faturamento")?.value ?? 0;
  const cpa = venda?.metrics.find((m) => m.label === "CPA")?.value ?? null;
  const ticketMedio = vendasNum > 0 ? faturamento / vendasNum : 97;
  const aprovacao = venda?.conversao?.value ?? null;

  // Métricas de recuperação
  const pedidosComRegua = recuperacao?.metrics.find((m) => m.label === "Pedidos com régua")?.value ?? 0;
  const recupTaxa = recuperacao?.conversao?.value ?? null;

  // ─────────────────────────────────────────────────────────────
  // 1. ANOMALIA: Queda de Taxa de Chegada (PageSpeed / Drop DNS)
  // ─────────────────────────────────────────────────────────────
  if (clicks >= 25 && chegada !== null && chegada < 48) {
    const baseline = REFERENCIA.chegada; // 70%
    const lostVisitors = Math.max(0, Math.round(clicks * ((baseline - chegada) / 100)));
    const wastedSpend = round(lostVisitors * (cpc || 1.5));
    const severity: AnomalySeverity = chegada < 35 ? "critica" : "alta";

    anomalies.push({
      id: "anomalia-chegada-pagespeed",
      type: "queda_chegada_pagespeed",
      severity,
      stageId: "pagina",
      title: "Vazamento na Chegada: Leads abandonam antes da página carregar",
      badge: severity === "critica" ? "Perda Crítica de Tráfego" : "PageSpeed Lento",
      metricCurrent: chegada,
      metricBaseline: baseline,
      unit: "%",
      dropPct: round(((baseline - chegada) / baseline) * 100, 1),
      triggerDescription: `Apenas ${chegada}% dos ${clicks} cliques no anúncio chegam a abrir a página (meta de referência: ${baseline}%+). Estima-se ~${lostVisitors} visitantes perdidos no carregamento.`,
      impactBrlEstimate: wastedSpend,
      actionSuggestion: "Otimizar imagens da página para WebP, ativar compressão Brotli e adiar scripts externos pesados.",
      playbookType: "pagespeed",
      detectedAt: nowIso,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ANOMALIA: Picos de Recusa no Checkout (Gateway / Antifraude)
  // ─────────────────────────────────────────────────────────────
  if (pedidos >= 5 && aprovacao !== null && aprovacao < 36) {
    const baseline = REFERENCIA.aprovacao; // 50%
    const lostSales = Math.max(0, Math.round(pedidos * ((baseline - aprovacao) / 100)));
    const lostRevenue = round(lostSales * ticketMedio);

    anomalies.push({
      id: "anomalia-recusa-gateway",
      type: "recusa_gateway_checkout",
      severity: "critica",
      stageId: "venda",
      title: "Pico de Recusa de Pagamentos no Checkout",
      badge: "Falha de Aprovação Gateway",
      metricCurrent: aprovacao,
      metricBaseline: baseline,
      unit: "%",
      dropPct: round(((baseline - aprovacao) / baseline) * 100, 1),
      triggerDescription: `A taxa de aprovação despencou para ${aprovacao}% de ${pedidos} pedidos gerados (normal: ${baseline}%+). Indicativo de recusa em massa de cartão ou instabilidade de gateway.`,
      impactBrlEstimate: lostRevenue,
      actionSuggestion: "Verificar conectividade com a adquirente/gateway, ativar contingência de cartão e destacar PIX instantâneo no checkout.",
      playbookType: "checkout_friction",
      detectedAt: nowIso,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ANOMALIA: Explosão de CPA (Fadiga de Criativo)
  // ─────────────────────────────────────────────────────────────
  if (spend >= 120 && cpa !== null && (cpa > 95 || (funnel.totais.roas !== null && funnel.totais.roas < 0.75))) {
    const targetCpa = 50; // alvo padrão
    const excessCost = Math.max(0, round((cpa - targetCpa) * vendasNum));

    anomalies.push({
      id: "anomalia-surto-cpa",
      type: "surto_cpa_fatiga",
      severity: cpa > 130 ? "critica" : "alta",
      stageId: "anuncio",
      title: "Surto de CPA: Custo por Aquisição Acima do Ponto de Equilíbrio",
      badge: "Fadiga de Criativo / Escala Forçada",
      metricCurrent: cpa,
      metricBaseline: targetCpa,
      unit: "brl",
      dropPct: round(((cpa - targetCpa) / targetCpa) * 100, 1),
      triggerDescription: `CPA registrado em R$ ${cpa.toFixed(2)} (alvo saudável: R$ ${targetCpa}). O custo de aquisição atual está corroendo a margem líquida da operação.`,
      impactBrlEstimate: excessCost > 0 ? excessCost : round(spend * 0.4),
      actionSuggestion: "Pausar anúncios saturados com CTR decadente e subir novo lote de criativos com ganchos disruptivos.",
      playbookType: "creatives",
      detectedAt: nowIso,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ANOMALIA: Quebra de Retenção de VSL (Pitch Ineficaz / Player)
  // ─────────────────────────────────────────────────────────────
  if (visits >= 40 && inicioCheckout !== null && inicioCheckout < 3.5) {
    const baseline = REFERENCIA.inicio_checkout; // 8%
    const lostCheckouts = Math.max(0, Math.round(visits * ((baseline - inicioCheckout) / 100)));
    const lostRevenueEst = round(lostCheckouts * 0.4 * ticketMedio);

    anomalies.push({
      id: "anomalia-queda-vsl",
      type: "queda_retencao_vsl",
      severity: "alta",
      stageId: "checkout",
      title: "Evasão Severa na VSL: Visitantes não chegam ao pitch de compra",
      badge: "Evasão de Retenção",
      metricCurrent: inicioCheckout,
      metricBaseline: baseline,
      unit: "%",
      dropPct: round(((baseline - inicioCheckout) / baseline) * 100, 1),
      triggerDescription: `Apenas ${inicioCheckout}% dos ${visits} visitantes iniciaram o checkout (esperado: ${baseline}%+). Leads desistem da apresentação antes da revelação da oferta.`,
      impactBrlEstimate: lostRevenueEst,
      actionSuggestion: "Auditar a curva de retenção do player, encurtar a história para pitch em ≤ 12min e adiantar botão de compra.",
      playbookType: "copy_vsl",
      detectedAt: nowIso,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ANOMALIA: Silêncio de Recuperação no WhatsApp
  // ─────────────────────────────────────────────────────────────
  if (pedidosComRegua >= 4 && recupTaxa !== null && recupTaxa < 10) {
    const baseline = REFERENCIA.recuperacao; // 20%
    const lostRecovered = Math.max(0, Math.round(pedidosComRegua * ((baseline - recupTaxa) / 100)));
    const lostRev = round(lostRecovered * ticketMedio);

    anomalies.push({
      id: "anomalia-silencio-whatsapp",
      type: "silencio_whatsapp_recuperacao",
      severity: "media",
      stageId: "recuperacao",
      title: "Baixa Efetividade na Recuperação via WhatsApp",
      badge: "Desconexão ou Atraso no WhatsApp",
      metricCurrent: recupTaxa,
      metricBaseline: baseline,
      unit: "%",
      dropPct: round(((baseline - recupTaxa) / baseline) * 100, 1),
      triggerDescription: `Apenas ${recupTaxa}% dos pedidos na régua foram recuperados. Leads que abandonam não recebem resposta no timing certo (< 15 minutos).`,
      impactBrlEstimate: lostRev,
      actionSuggestion: "Ajustar o primeiro disparo para 5 minutos pós-abandono com tom humanizado de suporte ao cliente.",
      playbookType: "recovery_wa",
      detectedAt: nowIso,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 6. ANOMALIA: Discrepância de Pixel / Medição Incompleta
  // ─────────────────────────────────────────────────────────────
  if (clicks >= 20 && visits === 0) {
    anomalies.push({
      id: "anomalia-pixel-ausente",
      type: "discrepancia_pixel_medicao",
      severity: "critica",
      stageId: "pagina",
      title: "Tráfego sem Rastreamento: Pixel ou Script do Império Inativo",
      badge: "Pixel Ausente",
      metricCurrent: 0,
      metricBaseline: clicks,
      unit: "qty",
      dropPct: 100,
      triggerDescription: `Foram computados ${clicks} cliques em anúncios, mas nenhuma visita foi registrada pela página. O rastreador não está instalado ou o domínio está inacessível.`,
      impactBrlEstimate: round(spend || 50),
      actionSuggestion: "Instalar o script de rastreamento do Império no cabeçalho <head> da página de vendas.",
      playbookType: "pagespeed",
      detectedAt: nowIso,
    });
  }

  const criticalCount = anomalies.filter((a) => a.severity === "critica").length;
  const totalLeakEstimateBrl = round(anomalies.reduce((acc, a) => acc + a.impactBrlEstimate, 0));
  const status: "seguro" | "alerta" | "critico" =
    criticalCount > 0 ? "critico" : anomalies.length > 0 ? "alerta" : "seguro";

  return {
    projectId,
    monitoredAt: nowIso,
    activeAnomalies: anomalies,
    criticalCount,
    totalLeakEstimateBrl,
    status,
  };
}

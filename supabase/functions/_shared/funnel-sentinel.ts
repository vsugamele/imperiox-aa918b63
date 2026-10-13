// Sentinela de Vazamento Proativo do Funil (FUN1.4 / SENTINEL).
// Motor analítico autônomo que monitora desvios, quedas de taxas, surtos de CPA e
// falhas de checkout/gateway, estimando o valor financeiro do vazamento em tempo real.
// TS puro, compartilhado entre frontend, edge functions e MCP.

import type { FunnelLive, StageId } from "./funnel-live";
import { REFERENCIA } from "./funnel-live";
import { runFunnelDiagnostics, type ActionType, type FunnelDiagnosticItem } from "./funnel-diagnostics";

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

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 2: DESPACHO DE TAREFA EM 1 CLIQUE (GARGALO ➔ KANBAN DA EQUIPE)
// ─────────────────────────────────────────────────────────────────────────────

export interface KanbanDiagnosticPayload {
  title: string;
  description: string;
  priority: "urgent" | "high" | "medium";
  project_id: string | null;
  board: string;
  ai_generated: boolean;
  tags: string[];
}

const PLAYBOOK_CHECKLISTS: Record<ActionType, string[]> = {
  pagespeed: [
    "[ ] Converter imagens da LP/VSL para WebP (<120KB por asset)",
    "[ ] Adiar scripts de terceiros (GTM, Clarity, pixels secundários) em 2000ms",
    "[ ] Habilitar compressão Brotli e Edge Cache na CDN",
    "[ ] Validar tempo de carregamento mobile < 2.2s no PageSpeed Insights",
  ],
  copy_vsl: [
    "[ ] Antecipar o delay do botão de compra em 45 a 60 segundos",
    "[ ] Inserir loop aberto de curiosidade nos primeiros 90 segundos da VSL",
    "[ ] Espelhar a headline da primeira dobra com a promessa do anúncio vencedor",
    "[ ] Lançar Teste A/B (50/50) desafiando a página controle",
  ],
  checkout_friction: [
    "[ ] Reduzir formulário de checkout para 4 campos (Nome, E-mail, WhatsApp, CPF)",
    "[ ] Pré-selecionar PIX instantâneo com destaque visual na abertura",
    "[ ] Ativar fallback/contingência automática de gateway para cartões recusados",
  ],
  bumps: [
    "[ ] Configurar Order Bump Acelerador (R$ 19,90) com 1 clique no checkout",
    "[ ] Configurar Order Bump de Blindagem/Suporte VIP (R$ 14,90)",
    "[ ] Revisar copy do box tracejado para destacar ganho de velocidade",
  ],
  recovery_wa: [
    "[ ] Configurar Toque 1 em 5 minutos pós-abandono (suporte humanizado PIX/Cartão)",
    "[ ] Gravar e anexar áudio humanizado de 25s para o Toque 2 (45 minutos)",
    "[ ] Ativar disparo de fechamento de lote em 24 horas",
  ],
  creatives: [
    "[ ] Pausar conjuntos/criativos com CTR < 1,2% ou CPA acima do teto",
    "[ ] Gravar/subir lote de 5 Ganchos Anti-Fadiga (P1 a P5) gerados pela Sentinela",
    "[ ] Testar nova 1ª linha de texto principal focada no mecanismo único",
  ],
  scale: [
    "[ ] Aumentar orçamento diário em +20% mantendo janela de aprendizado de 48h",
    "[ ] Duplicar conjunto vencedor para lookalike aberto (escala horizontal)",
    "[ ] Monitorar teto de CPA (circuit breaker) a cada 12h",
  ],
};

/**
 * Constrói o card estruturado do Kanban a partir de um diagnóstico ou anomalia do funil.
 */
export function buildKanbanCardFromDiagnostic(
  diagnostic: FunnelDiagnosticItem,
  projectId?: string | null,
  projectName?: string
): KanbanDiagnosticPayload {
  const priority: "urgent" | "high" | "medium" =
    diagnostic.severity === "critico"
      ? "urgent"
      : diagnostic.severity === "alerta"
      ? "high"
      : "medium";

  const checklist = PLAYBOOK_CHECKLISTS[diagnostic.action.type] ?? [
    `[ ] Executar: ${diagnostic.recommendation}`,
  ];

  const descriptionLines = [
    `🎯 **Projeto:** ${projectName || projectId || "Geral"}`,
    `🔗 **Transição Afetada:** ${diagnostic.stagePair.join(" ➔ ")}`,
    `📊 **Métrica Detectada:** ${diagnostic.metricComparison}`,
    diagnostic.estimatedLeak ? `💸 **Impacto / Vazamento Estimado:** ${diagnostic.estimatedLeak}` : null,
    "",
    `### 🔍 Causa-Raiz Identificada`,
    diagnostic.rootCause,
    "",
    `### ⚡ Playbook Técnico de Execução`,
    ...checklist,
  ].filter((line): line is string => line !== null);

  const tags = [
    projectId || "geral",
    "sentinela-funil",
    diagnostic.action.type,
  ];

  return {
    title: `[${diagnostic.badge.toUpperCase()}] ${diagnostic.title}`,
    description: descriptionLines.join("\n"),
    priority,
    project_id: projectId ?? null,
    board: "operacional",
    ai_generated: true,
    tags,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 4: PONTE SENTINELA DE TRÁFEGO ➔ GERADOR ANTI-FADIGA DE GANCHOS (P1–P5)
// ─────────────────────────────────────────────────────────────────────────────

export interface AntiFatigueHookInput {
  projectName?: string;
  avatarNome?: string;
  dorPrincipal?: string;
  desejoPrincipal?: string;
  mecanismoNome?: string;
  cpaCurrent?: number | null;
}

export interface AntiFatigueHookItem {
  code: "P1" | "P2" | "P3" | "P4" | "P5";
  angle: string;
  hook0to3s: string;
  primaryTextFirstLine: string;
  visualDirection: string;
  whyItWorks: string;
}

/**
 * Gera 5 ganchos anti-fadiga (P1 a P5) ancorados no Avatar e Mecanismo Único do projeto
 * quando a Sentinela detecta queda de CTR ou surto de CPA.
 */
export function generateAntiFatigueHooks(input: AntiFatigueHookInput): AntiFatigueHookItem[] {
  const produto = input.projectName?.trim() || "Protocolo";
  const dor = input.dorPrincipal?.trim() || "travar no meio do caminho sem ver resultado";
  const desejo = input.desejoPrincipal?.trim() || "destravar resultados visíveis em poucos dias";
  const mecanismo = input.mecanismoNome?.trim() || `Mecanismo ${produto}`;

  return [
    {
      code: "P1",
      angle: "Quebra de Padrão / Erro Invisível",
      hook0to3s: `"Pare de tentar resolver ${dor} do jeito tradicional — é exatamente isso que está bloqueando você."`,
      primaryTextFirstLine: `9 em cada 10 pessoas que tentam ${desejo} cometem este erro silencioso logo nos primeiros 3 minutos.`,
      visualDirection: "Corte seco nos primeiros 1.5s mostrando o erro comum riscado em vermelho + close no rosto.",
      whyItWorks: "Interrompe o scroll atacando a tentativa frustrada que o avatar já fez hoje.",
    },
    {
      code: "P2",
      angle: "Revelação do Mecanismo Único",
      hook0to3s: `"Não é falta de esforço: enquanto você não ativar o ${mecanismo}, o problema de ${dor} sempre volta."`,
      primaryTextFirstLine: `Descubra por que o ${mecanismo} está substituindo os métodos antigos para quem busca ${desejo}.`,
      visualDirection: "Comparação lado a lado (Método Antigo Lento vs. ${mecanismo} Direto) com legenda dinâmica.",
      whyItWorks: "Remove a culpa do avatar e transfere a responsabilidade para a ausência do mecanismo novo.",
    },
    {
      code: "P3",
      angle: "Especificidade & Prova Direta",
      hook0to3s: `"Eu cronometrei quanto tempo leva para aplicar o ${mecanismo} na prática e o resultado me assustou."`,
      primaryTextFirstLine: `Sem teoria enrolada: veja o passo a passo exato do ${produto} funcionando em tempo real.`,
      visualDirection: " Demonstração de tela ou prova física nos primeiros 2 segundos com cronômetro ou antes/depois real.",
      whyItWorks: "Destrói o ceticismo ('yeah, sure') substituindo promessa abstrata por demonstração mensurável.",
    },
    {
      code: "P4",
      angle: "Pergunta de Diagnóstico (Sintoma Ignorado)",
      hook0to3s: `"Se você sente ${dor} toda semana, faça este teste rápido de 10 segundos agora."`,
      primaryTextFirstLine: `Você reconhece algum destes 3 sinais? O 2º é o maior indicador de que você precisa do ${mecanismo}.`,
      visualDirection: "Avatar apontando para 3 itens na tela que acendem conforme são falados.",
      whyItWorks: "Gera autodiagnóstico imediato e micro-comprometimento antes do clique para a VSL.",
    },
    {
      code: "P5",
      angle: "Contraste de Inimigo Comum / Anti-Hype",
      hook0to3s: `"Ninguém no mercado quer te contar isso sobre ${dor}, porque o jeito simples não vende mensalidade cara."`,
      primaryTextFirstLine: `A verdade nua e crua sobre como ${desejo} usando o protocolo ${produto} sem depender de sorte.`,
      visualDirection: "Estilo UGC orgânico nativo, sem cara de anúncio de estúdio, legenda simples estilo Stories.",
      whyItWorks: "Fura a cegueira de banner (ad blindness) parecendo conteúdo orgânico de bastidor.",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 5: MOTOR DE ESCALA SEGURA (PROTOCOLO DE FUNIL VERDE)
// ─────────────────────────────────────────────────────────────────────────────

export interface SafeScaleProtocol {
  isScaleReady: boolean;
  scaleTier: "bloqueado" | "cauteloso" | "agressivo_controlado";
  fluencyScore: number;
  currentDailySpend: number;
  recommendedDailySpend: number;
  budgetIncreasePct: number;
  projectedDailyRevenue: number;
  currentRoas: number | null;
  projectedRoasAfterElasticity: number | null;
  cpaCeilingBreaker: number;
  verticalVsHorizontalSplit: {
    verticalPct: number;
    horizontalPct: number;
    guidance: string;
  };
  steps: string[];
  blockReason?: string;
}

/**
 * Calcula o protocolo prescritivo de escala segura quando o funil atinge saúde verde,
 * ou informa o bloqueio técnico caso ainda existam vazamentos críticos.
 */
export function calculateSafeScaleProtocol(
  funnel: FunnelLive,
  days = 7,
  targetRoas = 1.4
): SafeScaleProtocol {
  const periodDays = Math.max(1, days);
  const diag = runFunnelDiagnostics(funnel);
  const sentinel = scanFunnelAnomalies(funnel);

  const totalSpend = funnel.totais.gasto ?? 0;
  const totalBruto = funnel.totais.bruto ?? 0;
  const currentRoas = funnel.totais.roas;
  const currentCpa = funnel.totais.cpa;

  const currentDailySpend = round(totalSpend / periodDays, 2);
  const baseCpa = currentCpa && currentCpa > 0 ? currentCpa : 45;
  const cpaCeilingBreaker = round(baseCpa * 1.25, 2);

  // Critério de prontidão para escala: Score >= 75, sem anomalias críticas e ROAS >= targetRoas
  const hasCriticalLeak = sentinel.criticalCount > 0 || diag.score < 70;
  const roasOk = currentRoas !== null && currentRoas >= targetRoas;

  if (hasCriticalLeak || !roasOk || totalSpend <= 0) {
    const blockReason =
      totalSpend <= 0
        ? "Sem investimento de tráfego medido no período para calcular elasticidade."
        : hasCriticalLeak
        ? `Existem vazamentos ativos (Score ${diag.score}/100). Corrija o gargalo antes de injetar mais verba.`
        : `ROAS atual (${currentRoas ?? 0}x) está abaixo da margem de segurança (${targetRoas}x).`;

    return {
      isScaleReady: false,
      scaleTier: "bloqueado",
      fluencyScore: diag.score,
      currentDailySpend,
      recommendedDailySpend: currentDailySpend,
      budgetIncreasePct: 0,
      projectedDailyRevenue: round(totalBruto / periodDays, 2),
      currentRoas,
      projectedRoasAfterElasticity: currentRoas,
      cpaCeilingBreaker,
      verticalVsHorizontalSplit: {
        verticalPct: 0,
        horizontalPct: 100,
        guidance: "Mantenha o orçamento travado e rode testes A/B na etapa gargalo antes de escalar.",
      },
      steps: [
        "1. Trave o orçamento atual para não amplificar o vazamento detectado.",
        `2. Execute o Playbook de correção na etapa em alerta (${diag.primaryBottleneck?.stagePair.join(" ➔ ") || "Funil"}).`,
        "3. Destrave a escala assim que o Score atingir ≥ 75 e o ROAS superar 1.4x.",
      ],
      blockReason,
    };
  }

  // Se ROAS >= 2.2 e Score >= 85 -> Escala Agressiva Controlada (+30%)
  // Caso contrário -> Escala Cautelosa (+20% regra clássica sem resetar aprendizado)
  const isHighRoas = (currentRoas ?? 0) >= 2.2 && diag.score >= 82;
  const budgetIncreasePct = isHighRoas ? 30 : 20;
  const recommendedDailySpend = round(currentDailySpend * (1 + budgetIncreasePct / 100), 2);

  // Elasticidade de CPA na escala: ~5% a 7% de compressão natural de ROAS ao subir orçamento
  const elasticityFactor = isHighRoas ? 0.93 : 0.95;
  const projectedRoasAfterElasticity =
    currentRoas !== null ? round(currentRoas * elasticityFactor, 2) : null;
  const projectedDailyRevenue =
    projectedRoasAfterElasticity !== null
      ? round(recommendedDailySpend * projectedRoasAfterElasticity, 2)
      : round((totalBruto / periodDays) * (1 + budgetIncreasePct / 100), 2);

  return {
    isScaleReady: true,
    scaleTier: isHighRoas ? "agressivo_controlado" : "cauteloso",
    fluencyScore: diag.score,
    currentDailySpend,
    recommendedDailySpend,
    budgetIncreasePct,
    projectedDailyRevenue,
    currentRoas,
    projectedRoasAfterElasticity,
    cpaCeilingBreaker,
    verticalVsHorizontalSplit: isHighRoas
      ? {
          verticalPct: 60,
          horizontalPct: 40,
          guidance:
            "60% via aumento direto de +20% nos conjuntos vencedores + 40% duplicando em novos públicos abertos/Lookalike.",
        }
      : {
          verticalPct: 80,
          horizontalPct: 20,
          guidance:
            "80% via incremento gradual de +20% no orçamento a cada 48h (sem reiniciar fase de aprendizado) + 20% em variação de gancho.",
        },
    steps: [
      `1. Subir orçamento diário de R$ ${currentDailySpend.toFixed(0)} para R$ ${recommendedDailySpend.toFixed(0)} (+${budgetIncreasePct}%) pela manhã.`,
      `2. Configurar regra de segurança (Circuit Breaker): pausar aumento se o CPA ultrapassar R$ ${cpaCeilingBreaker.toFixed(2)}.`,
      "3. Manter pelo menos 2 variações de criativo ativas para absorver a nova entrega sem saturar a frequência.",
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 4 (FASE 3): MEMÓRIA DE IMPACTO ("ANTES VS. DEPOIS" DAS INTERVENÇÕES)
// ─────────────────────────────────────────────────────────────────────────────

export interface FunnelInterventionSnapshot {
  id: string;
  projectId: string;
  title: string;
  stageId: StageId;
  actionType: ActionType;
  createdAt: string;
  baseline: {
    score: number;
    ctr: number | null;
    chegada: number | null;
    inicioCheckout: number | null;
    aprovacao: number | null;
    roas: number | null;
    cpa: number | null;
    bruto: number;
  };
}

export interface FunnelInterventionAttribution {
  snapshot: FunnelInterventionSnapshot;
  currentScore: number;
  scoreDelta: number;
  targetMetricLabel: string;
  beforeVal: number | null;
  afterVal: number | null;
  deltaVal: number | null;
  verdict: "positivo" | "neutro" | "negativo";
  summaryText: string;
}

export function createInterventionSnapshot(
  funnel: FunnelLive,
  params: {
    projectId: string;
    title: string;
    stageId: StageId;
    actionType: ActionType;
    createdAt?: string;
  }
): FunnelInterventionSnapshot {
  const diag = runFunnelDiagnostics(funnel);
  const stageMap = new Map(funnel.etapas.map((e) => [e.id, e]));

  return {
    id: `intv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: params.projectId,
    title: params.title,
    stageId: params.stageId,
    actionType: params.actionType,
    createdAt: params.createdAt ?? new Date().toISOString(),
    baseline: {
      score: diag.score,
      ctr: stageMap.get("anuncio")?.conversao?.value ?? null,
      chegada: stageMap.get("pagina")?.conversao?.value ?? null,
      inicioCheckout: stageMap.get("checkout")?.conversao?.value ?? null,
      aprovacao: stageMap.get("venda")?.conversao?.value ?? null,
      roas: funnel.totais.roas,
      cpa: funnel.totais.cpa,
      bruto: funnel.totais.bruto,
    },
  };
}

export function evaluateInterventionImpact(
  snapshot: FunnelInterventionSnapshot,
  currentFunnel: FunnelLive
): FunnelInterventionAttribution {
  const currentDiag = runFunnelDiagnostics(currentFunnel);
  const stageMap = new Map(currentFunnel.etapas.map((e) => [e.id, e]));
  const scoreDelta = currentDiag.score - snapshot.baseline.score;

  let targetMetricLabel = "Score de Fluidez";
  let beforeVal: number | null = snapshot.baseline.score;
  let afterVal: number | null = currentDiag.score;

  if (snapshot.stageId === "anuncio" || snapshot.actionType === "creatives") {
    targetMetricLabel = "CTR do Anúncio";
    beforeVal = snapshot.baseline.ctr;
    afterVal = stageMap.get("anuncio")?.conversao?.value ?? null;
  } else if (snapshot.stageId === "pagina" || snapshot.actionType === "pagespeed") {
    targetMetricLabel = "Taxa de Chegada";
    beforeVal = snapshot.baseline.chegada;
    afterVal = stageMap.get("pagina")?.conversao?.value ?? null;
  } else if (snapshot.stageId === "checkout" || snapshot.actionType === "copy_vsl") {
    targetMetricLabel = "Início de Checkout";
    beforeVal = snapshot.baseline.inicioCheckout;
    afterVal = stageMap.get("checkout")?.conversao?.value ?? null;
  } else if (snapshot.stageId === "venda" || snapshot.actionType === "checkout_friction") {
    targetMetricLabel = "Taxa de Aprovação";
    beforeVal = snapshot.baseline.aprovacao;
    afterVal = stageMap.get("venda")?.conversao?.value ?? null;
  } else if (snapshot.actionType === "scale") {
    targetMetricLabel = "ROAS";
    beforeVal = snapshot.baseline.roas;
    afterVal = currentFunnel.totais.roas;
  }

  const deltaVal =
    beforeVal !== null && afterVal !== null ? round(afterVal - beforeVal, 1) : null;

  const verdict: "positivo" | "neutro" | "negativo" =
    (deltaVal !== null && deltaVal >= 1) || scoreDelta >= 3
      ? "positivo"
      : (deltaVal !== null && deltaVal <= -1) || scoreDelta <= -3
      ? "negativo"
      : "neutro";

  const unit = targetMetricLabel === "ROAS" ? "x" : targetMetricLabel === "Score de Fluidez" ? "pts" : "%";
  const summaryText =
    beforeVal !== null && afterVal !== null
      ? `${targetMetricLabel}: ${beforeVal}${unit} ➔ ${afterVal}${unit} (${deltaVal !== null && deltaVal > 0 ? `+${deltaVal}` : deltaVal}${unit})`
      : `Score de Fluidez: ${snapshot.baseline.score} ➔ ${currentDiag.score} (${scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts)`;

  return {
    snapshot,
    currentScore: currentDiag.score,
    scoreDelta,
    targetMetricLabel,
    beforeVal,
    afterVal,
    deltaVal,
    verdict,
    summaryText,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM 5 (FASE 3): MAPA DE PRIORIDADE VIVA PARA AS 23 ABAS DO PROJETO
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectTabPriority {
  pillarId: "comando" | "inteligencia" | "performance" | "producao" | "infra";
  tabValue: string;
  tabLabel: string;
  severity: "critico" | "alerta" | "escala";
  reason: string;
}

export function mapBottleneckToProjectTab(funnel: FunnelLive): ProjectTabPriority | null {
  const diag = runFunnelDiagnostics(funnel);
  const sentinel = scanFunnelAnomalies(funnel);

  const primary = diag.primaryBottleneck;
  const topAnomaly = sentinel.activeAnomalies[0];

  if (topAnomaly?.type === "queda_chegada_pagespeed" || primary?.action.type === "pagespeed") {
    return {
      pillarId: "infra",
      tabValue: "sites",
      tabLabel: "Sites",
      severity: "critico",
      reason: "PageSpeed / Chegada abaixo da meta na Landing Page",
    };
  }

  if (topAnomaly?.type === "surto_cpa_fatiga" || primary?.action.type === "creatives" || funnel.gargalo === "anuncio") {
    return {
      pillarId: "producao",
      tabValue: "midia",
      tabLabel: "Mídia",
      severity: "critico",
      reason: "Fadiga de Criativo / CTR ou CPA exigindo novos Ganchos P1–P5",
    };
  }

  if (primary?.action.type === "copy_vsl" || funnel.gargalo === "checkout") {
    return {
      pillarId: "comando",
      tabValue: "raiox",
      tabLabel: "Raio-X & Funil",
      severity: "alerta",
      reason: "Retenção da VSL / Início de Checkout abaixo da referência",
    };
  }

  if (primary?.action.type === "checkout_friction" || funnel.gargalo === "venda") {
    return {
      pillarId: "comando",
      tabValue: "identidade",
      tabLabel: "Setup, Pixels & Links",
      severity: "critico",
      reason: "Atrito no Checkout / Recusa de Pagamento",
    };
  }

  if (primary?.action.type === "bumps" || funnel.gargalo === "extra") {
    return {
      pillarId: "comando",
      tabValue: "ecossistema",
      tabLabel: "Ecossistema & Produtos",
      severity: "alerta",
      reason: "Oportunidade de elevar LTV em Order Bumps / Upsell",
    };
  }

  if (primary?.action.type === "recovery_wa" || funnel.gargalo === "recuperacao") {
    return {
      pillarId: "comando",
      tabValue: "comando",
      tabLabel: "Comando",
      severity: "alerta",
      reason: "Recuperação de WhatsApp abaixo de 20%",
    };
  }

  if (diag.score >= 80 && (funnel.totais.roas ?? 0) >= 1.5) {
    return {
      pillarId: "performance",
      tabValue: "financas",
      tabLabel: "Finanças",
      severity: "escala",
      reason: "Janela de Escala Ativa (Funil Verde)",
    };
  }

  return null;
}



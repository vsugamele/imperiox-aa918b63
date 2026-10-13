// Motor de Diagnóstico Cruzado de Marketing (Cross-Stage Marketing Intelligence).
// TS puro sem dependências externas, compartilhado entre frontend, Edge Functions e MCP.
// Analisa as transições reais entre as etapas do funil (Anúncio → Página → Checkout → Venda → Bump/Upsell → WhatsApp)
// e identifica a causa raiz técnica e persuasiva (ex.: cliques bons mas chegada baixa = lentidão de página;
// visitas altas mas pouco checkout = retenção de VSL/pitch tardio; checkout alto mas pouca venda = fricção de pagamento).

import type { FunnelLive, StageId } from "./funnel-live";
import { REFERENCIA } from "./funnel-live";

export type DiagnosticSeverity = "critico" | "alerta" | "oportunidade" | "saudavel";
export type ActionType = "pagespeed" | "copy_vsl" | "checkout_friction" | "bumps" | "recovery_wa" | "creatives";

export interface FunnelDiagnosticItem {
  id: string;
  severity: DiagnosticSeverity;
  stagePair: [StageId, StageId] | [StageId];
  title: string;
  badge: string;
  metricComparison: string;
  rootCause: string;
  recommendation: string;
  action: {
    type: ActionType;
    label: string;
    hint: string;
  };
  estimatedLeak?: string | null;
}

export interface FunnelHealthReport {
  score: number; // 0 a 100
  scoreLabel: "Excelente" | "Saudável" | "Atenção" | "Crítico";
  diagnostics: FunnelDiagnosticItem[];
  primaryBottleneck: FunnelDiagnosticItem | null;
  healthyStagesCount: number;
  totalStagesCount: number;
}

export type TrafficTemperature = "frio" | "morno" | "quente" | "retencao" | "operacao";

export interface TemperatureInfo {
  temp: TrafficTemperature;
  label: string;
  shortLabel: string;
  iconName: "Snowflake" | "Sun" | "Flame" | "LifeBuoy" | "Cog";
  cls: string;
}

/**
 * Classifica a temperatura do tráfego/etapa para um nó do mapa ou funil.
 * ❄️ Frio (Topo / Descoberta)
 * 🌤️ Morno (Meio / Engajamento & Tese)
 * 🔥 Quente (Fundo / Decisão & Conversão)
 * 🛟 Retenção & Recuperação (WhatsApp / E-mail / Onboarding)
 */
export function classifyNodeTemperature(kind?: string | null, stageRole?: string | null, label?: string | null): TemperatureInfo {
  const k = (kind ?? "").toLowerCase();
  const r = (stageRole ?? "").toLowerCase();
  const l = (label ?? "").toLowerCase();

  // Retenção e recuperação
  if (
    k.includes("whatsapp") || k.includes("recuperacao") || k.includes("follow_up") || k.includes("email") ||
    k.includes("area_membros") || k.includes("comunidade") || k.includes("obrigado") ||
    r.includes("recuperação") || r.includes("retenção") || r.includes("pós-venda") || l.includes("recupera")
  ) {
    return {
      temp: "retencao",
      label: "Retenção & Pós-Venda",
      shortLabel: "🛟 Retenção",
      iconName: "LifeBuoy",
      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    };
  }

  // Fundo de funil / Quente (compra, checkout, oferta, bumps)
  if (
    k.includes("checkout") || k.includes("compra") || k.includes("orderbump") || k.includes("upsell") ||
    k.includes("downsell") || k.includes("oferta") || k.includes("pagina_oto") ||
    r.includes("conversão") || r.includes("fechamento") || r.includes("checkout") || l.includes("checkout") || l.includes("compra")
  ) {
    return {
      temp: "quente",
      label: "Tráfego Quente (Decisão)",
      shortLabel: "🔥 Quente",
      iconName: "Flame",
      cls: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    };
  }

  // Meio de funil / Morno (páginas, VSL, advertorial, quiz, webinar)
  if (
    k.includes("vsl") || k.includes("pagina_vendas") || k.includes("advertorial") || k.includes("quiz") ||
    k.includes("webinar") || k.includes("replay") || k.includes("blog") || k.includes("captura") ||
    r.includes("tese") || r.includes("vsl") || r.includes("apresentação") || l.includes("vsl") || l.includes("página")
  ) {
    return {
      temp: "morno",
      label: "Tráfego Morno (Tese & VSL)",
      shortLabel: "🌤️ Morno",
      iconName: "Sun",
      cls: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    };
  }

  // Topo de funil / Frio (anúncios, redes sociais, tráfego pago/orgânico)
  if (
    k.includes("ads") || k.includes("anuncio") || k.includes("reels") || k.includes("stories") ||
    k.includes("instagram") || k.includes("facebook") || k.includes("tiktok") || k.includes("youtube") ||
    k.includes("kwai") || k.includes("native") || k.includes("seo") || k.includes("organico") ||
    r.includes("atração") || r.includes("anúncio") || l.includes("anúncio") || l.includes("criativo")
  ) {
    return {
      temp: "frio",
      label: "Tráfego Frio (Topo & Ads)",
      shortLabel: "❄️ Frio",
      iconName: "Snowflake",
      cls: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    };
  }

  // Operação / Estrutura
  return {
    temp: "operacao",
    label: "Operação & Infra",
    shortLabel: "⚙️ Infra",
    iconName: "Cog",
    cls: "bg-muted text-muted-foreground border-border",
  };
}

/**
 * Executa o diagnóstico cruzado de marketing no funil ao vivo.
 * Identifica desalinhamento de métricas entre etapas adjacentes.
 */
export function runFunnelDiagnostics(funnel: FunnelLive): FunnelHealthReport {
  const diagnostics: FunnelDiagnosticItem[] = [];

  const stageMap = new Map(funnel.etapas.map((e) => [e.id, e]));
  const anuncio = stageMap.get("anuncio");
  const pagina = stageMap.get("pagina");
  const checkout = stageMap.get("checkout");
  const venda = stageMap.get("venda");
  const extra = stageMap.get("extra");
  const recuperacao = stageMap.get("recuperacao");

  // Extrair métricas principais
  const spend = anuncio?.metrics.find((m) => m.label === "Gasto")?.value ?? null;
  const clicks = anuncio?.metrics.find((m) => m.label === "Cliques")?.value ?? null;
  const ctr = anuncio?.conversao?.value ?? null;

  const visits = pagina?.metrics.find((m) => m.label === "Visitas")?.value ?? null;
  const pageButtonClicks = pagina?.metrics.find((m) => m.label === "Cliques no botão")?.value ?? null;
  const chegada = pagina?.conversao?.value ?? null;

  const checkoutsInit = checkout?.metrics.find((m) => m.label === "Checkouts iniciados")?.value ?? null;
  const pedidos = checkout?.metrics.find((m) => m.label === "Pedidos gerados")?.value ?? 0;
  const inicioCheckout = checkout?.conversao?.value ?? null;

  const vendasNum = venda?.metrics.find((m) => m.label === "Vendas")?.value ?? 0;
  const aprovacao = venda?.conversao?.value ?? null;

  const extraTaxa = extra?.conversao?.value ?? null;
  const extrasVendidos = extra?.metrics.find((m) => m.label === "Extras vendidos")?.value ?? 0;

  const pedidosComRegua = recuperacao?.metrics.find((m) => m.label === "Pedidos com régua")?.value ?? 0;
  const recupTaxa = recuperacao?.conversao?.value ?? null;

  // ─────────────────────────────────────────────────────────────
  // 1. ANÚNCIO ➔ PÁGINA: Vazamento por Lentidão / PageSpeed
  // ─────────────────────────────────────────────────────────────
  if (clicks !== null && clicks >= 15 && chegada !== null && chegada > 0) {
    if (chegada < 65) {
      const isSevere = chegada < 50;
      const perdaPct = Math.round(100 - chegada);
      diagnostics.push({
        id: "ads-to-page-speed",
        severity: isSevere ? "critico" : "alerta",
        stagePair: ["anuncio", "pagina"],
        title: isSevere
          ? "Vazamento Crítico: Cliques no Anúncio não chegam na Página"
          : "Atenção à Taxa de Chegada na Página",
        badge: "Velocidade da Página & Carregamento",
        metricComparison: `CTR ${ctr ?? "—"}% ➔ Taxa de Chegada ${chegada}% (Referência: ${REFERENCIA.chegada}%)`,
        rootCause: `Você tem ${clicks} cliques no anúncio, mas apenas ${visits ?? 0} pessoas esperaram a página abrir. Cerca de ${perdaPct}% dos usuários abandonaram no caminho. No tráfego mobile, páginas que demoram mais de 3 segundos para carregar o primeiro frame perdem até metade dos cliques pagos.`,
        recommendation: "Otimizar velocidade da LP: compactar imagens para formato WebP (<150KB), adiar carregamento de scripts pesados e verificar se a CDN está ativa.",
        action: {
          type: "pagespeed",
          label: "Auditar Velocidade da Página",
          hint: "Verificar tempo de resposta e peso dos recursos da LP",
        },
        estimatedLeak: `${perdaPct}% do tráfego pago perdido no carregamento`,
      });
    } else if (clicks >= 30 && ctr !== null && ctr >= 1.5 && visits !== null && visits >= 25 && pageButtonClicks !== null && pageButtonClicks === 0) {
      // 1.2 Quebra de Gancho / Desalinhamento Anúncio vs Dobra 1
      diagnostics.push({
        id: "ads-page-hook-mismatch",
        severity: "alerta",
        stagePair: ["anuncio", "pagina"],
        title: "Quebra de Expectativa: Promessa do Anúncio ausente na Página",
        badge: "Alinhamento Anúncio vs LP",
        metricComparison: `CTR forte de ${ctr}% com 0 cliques no botão após ${visits} visitas`,
        rootCause: "O anúncio atrai com sucesso o clique, mas o visitante chega e sai imediatamente sem interagir com o conteúdo. A promessa ou gancho do criativo não está destacada na primeira dobra da página.",
        recommendation: "Espelhar a headline e o tema visual do criativo vencedor exatamente no título principal da página de vendas.",
        action: {
          type: "copy_vsl",
          label: "Revisar Dobra 1 da LP",
          hint: "Alinhar mensagem do anúncio com a headline da página",
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. PÁGINA ➔ CHECKOUT: Retenção de VSL ou Pitch com Atraso
  // ─────────────────────────────────────────────────────────────
  if (visits !== null && visits >= 25 && inicioCheckout !== null) {
    if (inicioCheckout < 5.0) {
      const isSevere = inicioCheckout < 3.0;
      diagnostics.push({
        id: "page-to-checkout-vsl",
        severity: isSevere ? "critico" : "alerta",
        stagePair: ["pagina", "checkout"],
        title: isSevere
          ? "Gargalo Persuasivo: Poucos Visitantes Iniciam Checkout"
          : "Início de Checkout abaixo da Média",
        badge: "Retenção da VSL & Delay do Botão",
        metricComparison: `Início de Checkout ${inicioCheckout}% (Referência saudável: ${REFERENCIA.inicio_checkout}% a 12%)`,
        rootCause: `De ${visits} visitantes, apenas ${checkoutsInit ?? 0} avançaram para o checkout. Em páginas com VSL, isso costuma indicar que os leads saem antes da revelação do mecanismo único (minutos 3 a 7) ou o botão de compra está com tempo de delay muito estendido.`,
        recommendation: "Auditar a retenção do vídeo de vendas no player (VTurb/Panda), antecipar a liberação do botão em 30 a 60 segundos ou testar um lead com gancho mais intrigante.",
        action: {
          type: "copy_vsl",
          label: "Auditar Retenção & VSL",
          hint: "Verificar curva de retenção do vídeo e momento do pitch",
        },
        estimatedLeak: `Menos de ${inicioCheckout}% dos visitantes chegam à oferta`,
      });
    } else if (inicioCheckout >= 10.0 && (ctr === null || ctr < 1.0 || (spend !== null && spend < 150))) {
      // 2.2 Oportunidade de Escala: Página Converte Muito Bem!
      diagnostics.push({
        id: "scale-opportunity-high-conversion",
        severity: "oportunidade",
        stagePair: ["pagina", "checkout"],
        title: "Alta Conversão Detectada: Funil pronto para Escala",
        badge: "Oportunidade de Escala",
        metricComparison: `Início de Checkout em ${inicioCheckout}% (acima da média)`,
        rootCause: "Sua página e oferta têm excelente tração com quem visita. O limitador do seu faturamento neste momento é o volume de tráfego e CTR dos criativos.",
        recommendation: "Injetar novos lotes de anúncios (hooks variados P1 a P5) para alimentar este funil e escalar orçamento com segurança.",
        action: {
          type: "creatives",
          label: "Gerar Novos Ganchos de Ads",
          hint: "Multiplicar tráfego para a página de alta conversão",
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CHECKOUT ➔ VENDA: Fricção de Pagamento & Gateway
  // ─────────────────────────────────────────────────────────────
  if (pedidos >= 5 && aprovacao !== null) {
    if (aprovacao < 40) {
      const isSevere = aprovacao < 28;
      diagnostics.push({
        id: "checkout-friction-gateway",
        severity: isSevere ? "critico" : "alerta",
        stagePair: ["checkout", "venda"],
        title: isSevere
          ? "Fricção Crítica no Pagamento: Alta Taxa de Abandono"
          : "Taxa de Aprovação de Pedidos Baixa",
        badge: "Fricção de Checkout & Gateway",
        metricComparison: `Aprovação de ${aprovacao}% (Referência saudável: ${REFERENCIA.aprovacao}%+)`,
        rootCause: `De ${pedidos} pedidos gerados, apenas ${vendasNum} foram aprovados. Isso aponta atrito no checkout (excesso de campos desnecessários como endereço completo), recusa de cartão pelo antifraude ou ausência de PIX instantâneo em destaque.`,
        recommendation: "Manter checkout com campos enxutos (Nome, Email, Telefone, CPF), colocar PIX como método primário pré-selecionado e monitorar recusas de gateway.",
        action: {
          type: "checkout_friction",
          label: "Otimizar Checkout & PIX",
          hint: "Reduzir fricção de preenchimento e verificar gateway",
        },
        estimatedLeak: `${Math.round(100 - aprovacao)}% dos pedidos não são concluídos`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. VENDA ➔ BUMP / UPSELL: LTV e Carrinho
  // ─────────────────────────────────────────────────────────────
  if (vendasNum >= 5 && extraTaxa !== null) {
    if (extraTaxa < 10) {
      diagnostics.push({
        id: "low-bump-upsell-ltv",
        severity: "alerta",
        stagePair: ["venda", "extra"],
        title: "Submonetização de Carrinho: Order Bump com Baixo Aceite",
        badge: "Monetização de Carrinho & LTV",
        metricComparison: `Aceite de Extras em ${extraTaxa}% (Referência saudável: ${REFERENCIA.extra}% a 25%)`,
        rootCause: `Compradores do produto principal estão ignorando os complementos (${extrasVendidos} extras aceitos). O Order Bump atual pode ser desconectado do problema principal ou ter preço desproporcional.`,
        recommendation: "Oferecer um produto de aceleração rápida ('Protocolo 7 Dias') ou checklist complementar com valor entre 20% e 35% do valor da oferta frontal.",
        action: {
          type: "bumps",
          label: "Ajustar Oferta de Order Bump",
          hint: "Reformular promessa e precificação do complemento",
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ABANDONO ➔ WHATSAPP: Recuperação de Pedidos
  // ─────────────────────────────────────────────────────────────
  if (pedidosComRegua >= 4 && recupTaxa !== null) {
    if (recupTaxa < 12) {
      diagnostics.push({
        id: "low-whatsapp-recovery",
        severity: "alerta",
        stagePair: ["checkout", "recuperacao"],
        title: "Régua do WhatsApp com Baixa Efetividade",
        badge: "Recuperação no WhatsApp",
        metricComparison: `Recuperação em ${recupTaxa}% (Referência saudável: ${REFERENCIA.recuperacao}%+)`,
        rootCause: "Leads que geraram PIX ou abandonaram pedido não estão respondendo à régua de recuperação. Mensagens genéricas ou com atraso maior que 15 minutos perdem o timing de compra.",
        recommendation: "Ajustar o primeiro contato para 5 a 10 minutos após o abandono com tom humanizado de suporte ('Oi [Nome], vi que tentou o PIX... precisa de ajuda para liberar seu acesso?').",
        action: {
          type: "recovery_wa",
          label: "Ajustar Régua de WhatsApp",
          hint: "Configurar mensagens humanizadas e tempos de disparo",
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Se não houver problemas críticos, emitir diagnóstico de equilíbrio
  // ─────────────────────────────────────────────────────────────
  if (diagnostics.length === 0 && (vendasNum > 0 || visits !== null)) {
    diagnostics.push({
      id: "funnel-healthy-flow",
      severity: "saudavel",
      stagePair: ["anuncio", "venda"],
      title: "Funil em Operação Harmoniosa",
      badge: "Sinergia de Ponta a Ponta",
      metricComparison: "Todas as conversões medidas estão dentro ou acima dos parâmetros de referência",
      rootCause: "Não foram detectados vazamentos graves entre as etapas. A taxa de chegada, retenção de checkout e aprovação estão fluindo de forma equilibrada.",
      recommendation: "Manter o monitoramento contínuo e testar expansão gradual de orçamento e novos testes A/B.",
      action: {
        type: "creatives",
        label: "Monitorar & Escalar",
        hint: "Acompanhar métricas em tempo real",
      },
    });
  }

  // Cálculo de pontuação global (Score 0-100)
  let score = 100;
  for (const d of diagnostics) {
    if (d.severity === "critico") score -= 28;
    else if (d.severity === "alerta") score -= 14;
    else if (d.severity === "oportunidade") score -= 4;
  }
  score = Math.max(10, Math.min(100, score));

  const scoreLabel = score >= 85 ? "Excelente" : score >= 70 ? "Saudável" : score >= 50 ? "Atenção" : "Crítico";
  const primaryBottleneck = diagnostics.find((d) => d.severity === "critico") ?? diagnostics.find((d) => d.severity === "alerta") ?? null;
  const healthyStagesCount = funnel.etapas.filter((e) => e.status === "ok").length;

  return {
    score,
    scoreLabel,
    diagnostics,
    primaryBottleneck,
    healthyStagesCount,
    totalStagesCount: funnel.etapas.length,
  };
}

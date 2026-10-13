// Painel ao vivo do funil (FUN1.1 + Fase 3): anúncio → página → checkout → venda → bump/upsell → recuperação,
// com números reais de cada etapa, benchmarks dinâmicos por arquétipo de funil, tendência temporal (Δ vs período anterior)
// e radar de CX pós-checkout (fricção de pagamento, recusas recuperáveis via PIX e reembolsos/chargebacks).
// TS puro, usado pelo painel, Edge Functions e MCP.

export interface AdsRow {
  spend?: number | string | null;
  impressoes?: number | null;
  link_clicks?: number | null;
  cliques?: number | null;
  init_checkout?: number | null;
  purchases?: number | null;
  date?: string | null;
}

export interface PageRow {
  url: string;
  values: {
    sessoes_pagina?: number | null;
    cliques_cta?: number | null;
    cliques_checkout?: number | null;
  };
}

export interface SaleRow {
  status: string | null;
  valor: number | string | null;
  valor_liquido?: number | string | null;
  tipo_venda?: string | null;
  produto_nome?: string | null;
  data?: unknown;
  external_transaction_id?: string | null;
  created_at?: string | null;
}

export type StageId = "anuncio" | "pagina" | "checkout" | "venda" | "extra" | "recuperacao";
export type StageStatus = "ok" | "atencao" | "gargalo" | "sem_dado" | "medicao_incompleta";

export type FunnelArchetypeId =
  | "low_ticket_vsl"
  | "dtc_nutra_pdp"
  | "advertorial_nsl"
  | "high_ticket"
  | "organico_dm";

export interface FunnelBenchmark {
  id: FunnelArchetypeId;
  label: string;
  description: string;
  ctr: number;
  chegada: number;
  inicio_checkout: number;
  aprovacao: number;
  extra: number;
  recuperacao: number;
}

/** Referências de mercado padrão para infoproduto low ticket (mantido para retrocompatibilidade). */
export const REFERENCIA = {
  ctr: 1,
  chegada: 70,
  inicio_checkout: 8,
  aprovacao: 50,
  extra: 15,
  recuperacao: 20,
} as const;

/** Catálogo de arquétipos de funil com réguas calibradas por modelo de negócio. */
export const FUNNEL_ARCHETYPES: Record<FunnelArchetypeId, FunnelBenchmark> = {
  low_ticket_vsl: {
    id: "low_ticket_vsl",
    label: "Infoproduto Low Ticket / VSL",
    description: "Tráfego direto para VSL ou página de vendas de baixo ticket (R$ 19 a R$ 197).",
    ...REFERENCIA,
  },
  dtc_nutra_pdp: {
    id: "dtc_nutra_pdp",
    label: "DTC Nutra / Suplemento (PDP)",
    description: "E-commerce direto ao consumidor ou oferta física com potes/kits e alto take-rate.",
    ctr: 1.5,
    chegada: 75,
    inicio_checkout: 14,
    aprovacao: 55,
    extra: 22,
    recuperacao: 25,
  },
  advertorial_nsl: {
    id: "advertorial_nsl",
    label: "Advertorial / Native Sales Letter",
    description: "Anúncio nativo ou pré-sell editorial aquecendo o clique antes da oferta.",
    ctr: 1.8,
    chegada: 72,
    inicio_checkout: 10,
    aprovacao: 52,
    extra: 18,
    recuperacao: 20,
  },
  high_ticket: {
    id: "high_ticket",
    label: "High Ticket / Mentoria",
    description: "Funil de qualificação densa e ticket elevado com maior peso no fechamento individual.",
    ctr: 0.8,
    chegada: 68,
    inicio_checkout: 5,
    aprovacao: 40,
    extra: 10,
    recuperacao: 30,
  },
  organico_dm: {
    id: "organico_dm",
    label: "Orgânico / Comment-to-DM",
    description: "Reels/TikTok virais com automação de Direct e audiência pré-aquecida.",
    ctr: 2.5,
    chegada: 80,
    inicio_checkout: 15,
    aprovacao: 60,
    extra: 15,
    recuperacao: 25,
  },
};

/** Infere automaticamente o arquétipo do funil a partir da categoria ou nome do projeto. */
export function inferFunnelArchetype(
  category?: string | null,
  projectName?: string | null
): FunnelArchetypeId {
  const combined = `${category ?? ""} ${projectName ?? ""}`.toLowerCase();
  if (combined.includes("nutra") || combined.includes("dtc") || combined.includes("linfa") || combined.includes("slim")) {
    return "dtc_nutra_pdp";
  }
  if (combined.includes("advertorial") || combined.includes("nsl") || combined.includes("native")) {
    return "advertorial_nsl";
  }
  if (combined.includes("high") || combined.includes("mentoria") || combined.includes("expert")) {
    return "high_ticket";
  }
  if (combined.includes("organico") || combined.includes("orgânico") || combined.includes("dark") || combined.includes("reels")) {
    return "organico_dm";
  }
  return "low_ticket_vsl";
}

export interface Metric {
  label: string;
  value: number | null;
  fmt: "int" | "brl" | "pct";
}

export interface Stage {
  id: StageId;
  label: string;
  metrics: Metric[];
  /** Conversão para chegar nesta etapa a partir da anterior, com tendência temporal opcional. */
  conversao: {
    label: string;
    value: number | null;
    referencia: number;
    prevValue?: number | null;
    deltaPp?: number | null;
    trend?: "up" | "down" | "flat" | null;
  } | null;
  status: StageStatus;
  nota: string | null;
}

export interface FunnelCxMetrics {
  totalTentativas: number;
  aprovadasCount: number;
  recusadasCartaoCount: number;
  pendentesCount: number;
  reembolsadasCount: number;
  valorRecusadoRecuperavel: number;
  valorReembolsado: number;
  taxaFriccaoPagamentoPct: number;
  taxaReembolsoPct: number;
  cxScore: number;
  cxStatus: "excelente" | "atencao" | "critico";
  recomendacaoCx: string;
}

export interface FunnelLive {
  archetype?: FunnelArchetypeId;
  archetypeLabel?: string;
  totais: {
    gasto: number | null;
    bruto: number;
    liquido: number;
    saldo: number | null;
    roas: number | null;
    cpa: number | null;
    vendas: number;
    prevBruto?: number | null;
    brutoDeltaPct?: number | null;
    prevRoas?: number | null;
    roasDelta?: number | null;
  };
  etapas: Stage[];
  gargalo: StageId | null;
  cx: FunnelCxMetrics;
}

const PAID = new Set(["aprovado", "approved", "paid", "pago", "completed"]);
const DECLINED = new Set(["recusado", "declined", "refused", "failed", "falhou", "negado", "cartao_recusado"]);
const PENDING = new Set(["pendente", "waiting_payment", "aguardando_pagamento", "gerado", "pending", "pix_gerado", "boleto_gerado"]);
const REFUNDED = new Set(["reembolsado", "refunded", "chargeback", "estornado", "disputa", "reembolso"]);

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const pct = (num: number, den: number) => (den > 0 ? round((num / den) * 100, 1) : null);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function statusFor(value: number | null, ref: number): StageStatus {
  if (value === null) return "sem_dado";
  if (value >= ref) return "ok";
  if (value >= ref * 0.5) return "atencao";
  return "gargalo";
}

function buildTrend(current: number | null, prev: number | null | undefined): {
  prevValue: number | null;
  deltaPp: number | null;
  trend: "up" | "down" | "flat" | null;
} {
  if (current === null || prev === null || prev === undefined) {
    return { prevValue: null, deltaPp: null, trend: null };
  }
  const deltaPp = round(current - prev, 1);
  const trend: "up" | "down" | "flat" =
    deltaPp >= 1.5 ? "up" : deltaPp <= -1.5 ? "down" : "flat";
  return { prevValue: prev, deltaPp, trend };
}

function computeRatesOnly(input: {
  ads: ReadonlyArray<AdsRow>;
  pages: ReadonlyArray<PageRow>;
  sales: ReadonlyArray<SaleRow>;
}) {
  const temAds = input.ads.length > 0;
  const gasto = temAds ? round(input.ads.reduce((s, a) => s + n(a.spend), 0)) : null;
  const imp = input.ads.reduce((s, a) => s + n(a.impressoes), 0);
  const cliques = input.ads.reduce((s, a) => s + n(a.link_clicks ?? a.cliques), 0);
  const icPixel = input.ads.reduce((s, a) => s + n(a.init_checkout), 0);

  const visitas = input.pages.reduce((s, p) => s + n(p.values.sessoes_pagina), 0);
  const ctaPagina = input.pages.reduce((s, p) => s + n(p.values.cliques_cta), 0);
  const temPagina = visitas > 0;

  const principais = input.sales.filter((s) => (s.tipo_venda ?? "principal") === "principal");
  const extras = input.sales.filter((s) => (s.tipo_venda ?? "principal") !== "principal");
  const pedidos = principais.filter((s) => String(s.status ?? "") !== "carrinho_abandonado");
  const aprovadas = principais.filter((s) => PAID.has(String(s.status ?? "").toLowerCase()));
  const extrasPagos = extras.filter((s) => PAID.has(String(s.status ?? "").toLowerCase()));
  const bruto = round([...aprovadas, ...extrasPagos].reduce((s, v) => s + n(v.valor), 0));
  const iniciados = Math.max(icPixel, ctaPagina, principais.length);

  const comRegua = principais.filter((s) => {
    const levels = obj(s.data).recovery_sent_levels;
    return Array.isArray(levels) && levels.length > 0;
  });
  const recuperadas = comRegua.filter((s) => PAID.has(String(s.status ?? "").toLowerCase()));

  return {
    gasto,
    bruto,
    roas: gasto ? round(bruto / gasto) : null,
    ctr: pct(cliques, imp),
    chegada: temPagina && cliques ? pct(visitas, cliques) : null,
    inicio: temPagina ? pct(iniciados, visitas) : null,
    aprovacao: pct(aprovadas.length, pedidos.length),
    extraTaxa: aprovadas.length ? pct(extrasPagos.length, aprovadas.length) : null,
    recup: comRegua.length ? pct(recuperadas.length, comRegua.length) : null,
  };
}

export function buildFunnelLive(input: {
  ads: ReadonlyArray<AdsRow>;
  pages: ReadonlyArray<PageRow>;
  sales: ReadonlyArray<SaleRow>;
  archetype?: FunnelArchetypeId;
  prevAds?: ReadonlyArray<AdsRow>;
  prevPages?: ReadonlyArray<PageRow>;
  prevSales?: ReadonlyArray<SaleRow>;
}): FunnelLive {
  const archetypeId: FunnelArchetypeId = input.archetype ?? "low_ticket_vsl";
  const bench = FUNNEL_ARCHETYPES[archetypeId] ?? FUNNEL_ARCHETYPES.low_ticket_vsl;

  const hasPrev =
    (input.prevAds && input.prevAds.length > 0) ||
    (input.prevPages && input.prevPages.length > 0) ||
    (input.prevSales && input.prevSales.length > 0);

  const prevStats = hasPrev
    ? computeRatesOnly({
        ads: input.prevAds ?? [],
        pages: input.prevPages ?? [],
        sales: input.prevSales ?? [],
      })
    : null;

  const temAds = input.ads.length > 0;
  const gasto = temAds ? round(input.ads.reduce((s, a) => s + n(a.spend), 0)) : null;
  const imp = input.ads.reduce((s, a) => s + n(a.impressoes), 0);
  const cliques = input.ads.reduce((s, a) => s + n(a.link_clicks ?? a.cliques), 0);
  const icPixel = input.ads.reduce((s, a) => s + n(a.init_checkout), 0);

  const visitas = input.pages.reduce((s, p) => s + n(p.values.sessoes_pagina), 0);
  const ctaPagina = input.pages.reduce((s, p) => s + n(p.values.cliques_cta), 0);
  const temPagina = visitas > 0;

  const principais = input.sales.filter((s) => (s.tipo_venda ?? "principal") === "principal");
  const extras = input.sales.filter((s) => (s.tipo_venda ?? "principal") !== "principal");
  const pedidos = principais.filter((s) => String(s.status ?? "") !== "carrinho_abandonado");
  const aprovadas = principais.filter((s) => PAID.has(String(s.status ?? "").toLowerCase()));
  const extrasPagos = extras.filter((s) => PAID.has(String(s.status ?? "").toLowerCase()));
  const bruto = round([...aprovadas, ...extrasPagos].reduce((s, v) => s + n(v.valor), 0));
  const liquido = round([...aprovadas, ...extrasPagos].reduce((s, v) => s + n(v.valor_liquido ?? v.valor), 0));
  const iniciados = Math.max(icPixel, ctaPagina, principais.length);

  // Só conta como recuperação quem recebeu a régua
  const comRegua = principais.filter((s) => {
    const levels = obj(s.data).recovery_sent_levels;
    return Array.isArray(levels) && levels.length > 0;
  });
  const recuperadas = comRegua.filter((s) => PAID.has(String(s.status ?? "").toLowerCase()));

  // Métricas de CX Pós-Checkout (Recusas de Cartão, Pendentes PIX e Reembolsos/Chargebacks)
  const recusadasCartao = principais.filter((s) => DECLINED.has(String(s.status ?? "").toLowerCase()));
  const pendentesPagto = principais.filter((s) => PENDING.has(String(s.status ?? "").toLowerCase()));
  const reembolsadas = input.sales.filter((s) => REFUNDED.has(String(s.status ?? "").toLowerCase()));

  const valorRecusadoRecuperavel = round(
    [...recusadasCartao, ...pendentesPagto].reduce((s, v) => s + n(v.valor), 0)
  );
  const valorReembolsado = round(reembolsadas.reduce((s, v) => s + n(v.valor), 0));

  const totalFinalizadasOuEstornadas = aprovadas.length + reembolsadas.length;
  const taxaReembolsoPct =
    totalFinalizadasOuEstornadas > 0
      ? round((reembolsadas.length / totalFinalizadasOuEstornadas) * 100, 1)
      : 0;
  const taxaFriccaoPagamentoPct =
    pedidos.length > 0
      ? round(((recusadasCartao.length + pendentesPagto.length) / pedidos.length) * 100, 1)
      : 0;

  let cxScore = 95;
  if (taxaReembolsoPct > 8) cxScore -= 35;
  else if (taxaReembolsoPct > 4) cxScore -= 18;
  if (taxaFriccaoPagamentoPct > 55) cxScore -= 25;
  else if (taxaFriccaoPagamentoPct > 35) cxScore -= 12;
  cxScore = Math.max(15, Math.min(100, cxScore));

  const cxStatus: "excelente" | "atencao" | "critico" =
    cxScore >= 80 ? "excelente" : cxScore >= 60 ? "atencao" : "critico";

  const recomendacaoCx =
    taxaReembolsoPct > 5
      ? "Alerta de Reembolso/Chargeback (>5%): reforce o onboarding nas primeiras 48h no WhatsApp e alinhe expectativa na entrega."
      : recusadasCartao.length > 0
      ? `${recusadasCartao.length} tentativa(s) de cartão recusada(s): dispare link de PIX imediato com R$ 10 de desconto nos primeiros 3 minutos.`
      : pendentesPagto.length > 0
      ? `${pendentesPagto.length} pedido(s) aguardando pagamento: acione o Toque 1 de suporte humanizado em até 5 minutos.`
      : "Jornada de pagamento e entrega operando sem atrito relevante.";

  const ctr = pct(cliques, imp);
  const chegada = temPagina && cliques ? pct(visitas, cliques) : null;
  const inicio = temPagina ? pct(iniciados, visitas) : null;
  const aprovacao = pct(aprovadas.length, pedidos.length);
  const extraTaxa = aprovadas.length ? pct(extrasPagos.length, aprovadas.length) : null;
  const recup = comRegua.length ? pct(recuperadas.length, comRegua.length) : null;

  const etapas: Stage[] = [
    {
      id: "anuncio",
      label: "Anúncio",
      metrics: [
        { label: "Gasto", value: gasto, fmt: "brl" },
        { label: "Impressões", value: temAds ? imp : null, fmt: "int" },
        { label: "Cliques", value: temAds ? cliques : null, fmt: "int" },
        { label: "CPC", value: cliques && gasto !== null ? round(gasto / cliques) : null, fmt: "brl" },
      ],
      conversao: {
        label: "CTR",
        value: ctr,
        referencia: bench.ctr,
        ...buildTrend(ctr, prevStats?.ctr),
      },
      status: temAds ? statusFor(ctr, bench.ctr) : "sem_dado",
      nota: temAds ? null : "Sem gasto sincronizado neste período (Zernio).",
    },
    {
      id: "pagina",
      label: "Página",
      metrics: [
        { label: "Visitas", value: temPagina ? visitas : null, fmt: "int" },
        { label: "Cliques no botão", value: temPagina ? ctaPagina : null, fmt: "int" },
      ],
      conversao: {
        label: "Chegada",
        value: chegada,
        referencia: bench.chegada,
        ...buildTrend(chegada, prevStats?.chegada),
      },
      status: !temPagina
        ? "sem_dado"
        : chegada !== null && chegada < 30
        ? "medicao_incompleta"
        : statusFor(chegada, bench.chegada),
      nota: !temPagina
        ? "A página não tem o rastreador do Império."
        : chegada !== null && chegada < 30
        ? `Só ${visitas} visitas medidas para ${cliques} cliques: falta o rastreador em alguma página.`
        : null,
    },
    {
      id: "checkout",
      label: "Checkout",
      metrics: [
        { label: "Checkouts iniciados", value: iniciados || null, fmt: "int" },
        { label: "Pedidos gerados", value: pedidos.length, fmt: "int" },
      ],
      conversao: {
        label: "Início de checkout",
        value: inicio,
        referencia: bench.inicio_checkout,
        ...buildTrend(inicio, prevStats?.inicio),
      },
      status:
        inicio !== null && inicio > 100
          ? "medicao_incompleta"
          : temPagina
          ? statusFor(inicio, bench.inicio_checkout)
          : iniciados
          ? "ok"
          : "sem_dado",
      nota:
        inicio !== null && inicio > 100
          ? `${iniciados} checkouts para ${visitas} visitas medidas: o pixel conta repetido ou falta rastreador na página.`
          : icPixel > ctaPagina
          ? "Checkouts pelo pixel do anúncio."
          : null,
    },
    {
      id: "venda",
      label: "Venda",
      metrics: [
        { label: "Vendas", value: aprovadas.length, fmt: "int" },
        { label: "Faturamento", value: round(aprovadas.reduce((s, v) => s + n(v.valor), 0)), fmt: "brl" },
        {
          label: "Ticket médio",
          value: aprovadas.length ? round(aprovadas.reduce((s, v) => s + n(v.valor), 0) / aprovadas.length) : null,
          fmt: "brl",
        },
        { label: "CPA", value: aprovadas.length && gasto !== null ? round(gasto / aprovadas.length) : null, fmt: "brl" },
      ],
      conversao: {
        label: "Aprovação dos pedidos",
        value: aprovacao,
        referencia: bench.aprovacao,
        ...buildTrend(aprovacao, prevStats?.aprovacao),
      },
      status: pedidos.length ? statusFor(aprovacao, bench.aprovacao) : "sem_dado",
      nota: null,
    },
    {
      id: "extra",
      label: "Bump e upsell",
      metrics: [
        { label: "Extras vendidos", value: extrasPagos.length, fmt: "int" },
        { label: "Receita extra", value: round(extrasPagos.reduce((s, v) => s + n(v.valor), 0)), fmt: "brl" },
      ],
      conversao: {
        label: "Aceite",
        value: extraTaxa,
        referencia: bench.extra,
        ...buildTrend(extraTaxa, prevStats?.extraTaxa),
      },
      status: !aprovadas.length ? "sem_dado" : extras.length === 0 ? "sem_dado" : statusFor(extraTaxa, bench.extra),
      nota:
        aprovadas.length && extras.length === 0
          ? "Nenhuma venda de bump ou upsell chegou da plataforma no período. Se o checkout tem bump, confira se o webhook do produto do bump aponta para o Império."
          : null,
    },
    {
      id: "recuperacao",
      label: "Recuperação no WhatsApp",
      metrics: [
        { label: "Pedidos com régua", value: comRegua.length, fmt: "int" },
        { label: "Recuperados", value: recuperadas.length, fmt: "int" },
      ],
      conversao: {
        label: "Recuperação",
        value: recup,
        referencia: bench.recuperacao,
        ...buildTrend(recup, prevStats?.recup),
      },
      status: comRegua.length ? statusFor(recup, bench.recuperacao) : "sem_dado",
      nota: null,
    },
  ];

  // Gargalo: a etapa medida mais abaixo da referência (proporcionalmente). Medição incompleta não conta.
  let gargalo: StageId | null = null;
  let pior = Infinity;
  for (const e of etapas) {
    if (e.status !== "gargalo" && e.status !== "atencao") continue;
    const ratio = (e.conversao?.value ?? 0) / (e.conversao?.referencia || 1);
    if (ratio < pior) {
      pior = ratio;
      gargalo = e.id;
    }
  }

  const roas = gasto ? round(bruto / gasto) : null;
  const prevBruto = prevStats ? prevStats.bruto : null;
  const brutoDeltaPct =
    prevBruto !== null && prevBruto > 0 ? round(((bruto - prevBruto) / prevBruto) * 100, 1) : null;
  const prevRoas = prevStats?.roas ?? null;
  const roasDelta = roas !== null && prevRoas !== null ? round(roas - prevRoas, 2) : null;

  return {
    archetype: archetypeId,
    archetypeLabel: bench.label,
    totais: {
      gasto,
      bruto,
      liquido,
      vendas: aprovadas.length,
      saldo: gasto !== null ? round(liquido - gasto) : null,
      roas,
      cpa: gasto !== null && aprovadas.length ? round(gasto / aprovadas.length) : null,
      prevBruto,
      brutoDeltaPct,
      prevRoas,
      roasDelta,
    },
    etapas,
    gargalo,
    cx: {
      totalTentativas: pedidos.length,
      aprovadasCount: aprovadas.length,
      recusadasCartaoCount: recusadasCartao.length,
      pendentesCount: pendentesPagto.length,
      reembolsadasCount: reembolsadas.length,
      valorRecusadoRecuperavel,
      valorReembolsado,
      taxaFriccaoPagamentoPct,
      taxaReembolsoPct,
      cxScore,
      cxStatus,
      recomendacaoCx,
    },
  };
}

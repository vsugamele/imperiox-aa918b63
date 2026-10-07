// Painel ao vivo do funil (FUN1.1): anúncio → página → checkout → venda → bump/upsell → recuperação, com os números
// reais de cada etapa, a conversão entre elas e o gargalo. Dado ausente aparece como ausente, nunca como zero.
// TS puro, usado pelo painel e pelo MCP.

export interface AdsRow { spend?: number | string | null; impressoes?: number | null; link_clicks?: number | null; cliques?: number | null; init_checkout?: number | null; purchases?: number | null }
export interface PageRow { url: string; values: { sessoes_pagina?: number | null; cliques_cta?: number | null; cliques_checkout?: number | null } }
export interface SaleRow { status: string | null; valor: number | string | null; valor_liquido?: number | string | null; tipo_venda?: string | null; produto_nome?: string | null; data?: unknown }

export type StageId = "anuncio" | "pagina" | "checkout" | "venda" | "extra" | "recuperacao";
export type StageStatus = "ok" | "atencao" | "gargalo" | "sem_dado" | "medicao_incompleta";

export interface Metric { label: string; value: number | null; fmt: "int" | "brl" | "pct" }
export interface Stage {
  id: StageId;
  label: string;
  metrics: Metric[];
  /** Conversão para chegar nesta etapa a partir da anterior. */
  conversao: { label: string; value: number | null; referencia: number } | null;
  status: StageStatus;
  nota: string | null;
}

export interface FunnelLive {
  totais: { gasto: number | null; bruto: number; liquido: number; saldo: number | null; roas: number | null; cpa: number | null; vendas: number };
  etapas: Stage[];
  gargalo: StageId | null;
}

/** Referências de mercado para infoproduto low ticket (ajustáveis). Servem para apontar o gargalo, não como meta. */
export const REFERENCIA = { ctr: 1, chegada: 70, inicio_checkout: 8, aprovacao: 50, extra: 15, recuperacao: 20 } as const;

const PAID = new Set(["aprovado", "approved", "paid", "pago", "completed"]);
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const pct = (num: number, den: number) => (den > 0 ? round((num / den) * 100, 1) : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

function statusFor(value: number | null, ref: number): StageStatus {
  if (value === null) return "sem_dado";
  if (value >= ref) return "ok";
  if (value >= ref * 0.5) return "atencao";
  return "gargalo";
}

export function buildFunnelLive(input: { ads: ReadonlyArray<AdsRow>; pages: ReadonlyArray<PageRow>; sales: ReadonlyArray<SaleRow> }): FunnelLive {
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

  // Só conta como recuperação quem recebeu a régua (a resposta imediata ao Pix não conta: a maioria paga em minutos).
  const comRegua = principais.filter((s) => {
    const levels = obj(s.data).recovery_sent_levels;
    return Array.isArray(levels) && levels.length > 0;
  });
  const recuperadas = comRegua.filter((s) => PAID.has(String(s.status ?? "").toLowerCase()));

  const ctr = pct(cliques, imp);
  const chegada = temPagina && cliques ? pct(visitas, cliques) : null;
  const inicio = temPagina ? pct(iniciados, visitas) : null;
  const aprovacao = pct(aprovadas.length, pedidos.length);
  const extraTaxa = aprovadas.length ? pct(extrasPagos.length, aprovadas.length) : null;
  const recup = comRegua.length ? pct(recuperadas.length, comRegua.length) : null;

  const etapas: Stage[] = [
    {
      id: "anuncio", label: "Anúncio",
      metrics: [
        { label: "Gasto", value: gasto, fmt: "brl" }, { label: "Impressões", value: temAds ? imp : null, fmt: "int" },
        { label: "Cliques", value: temAds ? cliques : null, fmt: "int" }, { label: "CPC", value: cliques && gasto !== null ? round(gasto / cliques) : null, fmt: "brl" },
      ],
      conversao: { label: "CTR", value: ctr, referencia: REFERENCIA.ctr },
      status: temAds ? statusFor(ctr, REFERENCIA.ctr) : "sem_dado",
      nota: temAds ? null : "Sem gasto sincronizado neste período (Zernio).",
    },
    {
      id: "pagina", label: "Página",
      metrics: [{ label: "Visitas", value: temPagina ? visitas : null, fmt: "int" }, { label: "Cliques no botão", value: temPagina ? ctaPagina : null, fmt: "int" }],
      conversao: { label: "Chegada", value: chegada, referencia: REFERENCIA.chegada },
      // Visitas muito abaixo dos cliques quase sempre é página sem rastreador, não gente sumindo.
      status: !temPagina ? "sem_dado" : chegada !== null && chegada < 30 ? "medicao_incompleta" : statusFor(chegada, REFERENCIA.chegada),
      nota: !temPagina ? "A página não tem o rastreador do Império." : chegada !== null && chegada < 30 ? `Só ${visitas} visitas medidas para ${cliques} cliques: falta o rastreador em alguma página.` : null,
    },
    {
      id: "checkout", label: "Checkout",
      metrics: [{ label: "Checkouts iniciados", value: iniciados || null, fmt: "int" }, { label: "Pedidos gerados", value: pedidos.length, fmt: "int" }],
      conversao: { label: "Início de checkout", value: inicio, referencia: REFERENCIA.inicio_checkout },
      status: inicio !== null && inicio > 100 ? "medicao_incompleta" : temPagina ? statusFor(inicio, REFERENCIA.inicio_checkout) : iniciados ? "ok" : "sem_dado",
      nota: inicio !== null && inicio > 100 ? `${iniciados} checkouts para ${visitas} visitas medidas: o pixel conta repetido ou falta rastreador na página.` : icPixel > ctaPagina ? "Checkouts pelo pixel do anúncio." : null,
    },
    {
      id: "venda", label: "Venda",
      metrics: [
        { label: "Vendas", value: aprovadas.length, fmt: "int" }, { label: "Faturamento", value: round(aprovadas.reduce((s, v) => s + n(v.valor), 0)), fmt: "brl" },
        { label: "Ticket médio", value: aprovadas.length ? round(aprovadas.reduce((s, v) => s + n(v.valor), 0) / aprovadas.length) : null, fmt: "brl" },
        { label: "CPA", value: aprovadas.length && gasto !== null ? round(gasto / aprovadas.length) : null, fmt: "brl" },
      ],
      conversao: { label: "Aprovação dos pedidos", value: aprovacao, referencia: REFERENCIA.aprovacao },
      status: pedidos.length ? statusFor(aprovacao, REFERENCIA.aprovacao) : "sem_dado",
      nota: null,
    },
    {
      id: "extra", label: "Bump e upsell",
      metrics: [{ label: "Extras vendidos", value: extrasPagos.length, fmt: "int" }, { label: "Receita extra", value: round(extrasPagos.reduce((s, v) => s + n(v.valor), 0)), fmt: "brl" }],
      conversao: { label: "Aceite", value: extraTaxa, referencia: REFERENCIA.extra },
      status: !aprovadas.length ? "sem_dado" : extras.length === 0 ? "sem_dado" : statusFor(extraTaxa, REFERENCIA.extra),
      nota: aprovadas.length && extras.length === 0 ? "Nenhum order bump ou upsell registrado: oportunidade de ticket." : null,
    },
    {
      id: "recuperacao", label: "Recuperação no WhatsApp",
      metrics: [{ label: "Pedidos com régua", value: comRegua.length, fmt: "int" }, { label: "Recuperados", value: recuperadas.length, fmt: "int" }],
      conversao: { label: "Recuperação", value: recup, referencia: REFERENCIA.recuperacao },
      status: comRegua.length ? statusFor(recup, REFERENCIA.recuperacao) : "sem_dado",
      nota: null,
    },
  ];

  // Gargalo: a etapa medida mais abaixo da referência (proporcionalmente). Medição incompleta não conta.
  let gargalo: StageId | null = null;
  let pior = Infinity;
  for (const e of etapas) {
    if (e.status !== "gargalo" && e.status !== "atencao") continue;
    const ratio = (e.conversao?.value ?? 0) / (e.conversao?.referencia || 1);
    if (ratio < pior) { pior = ratio; gargalo = e.id; }
  }

  return {
    totais: {
      gasto, bruto, liquido, vendas: aprovadas.length,
      saldo: gasto !== null ? round(liquido - gasto) : null,
      roas: gasto ? round(bruto / gasto) : null,
      cpa: gasto !== null && aprovadas.length ? round(gasto / aprovadas.length) : null,
    },
    etapas,
    gargalo,
  };
}

// Painel ao vivo do projeto (LIVE1.1): funil do dia, parcial (gasto, faturamento, vendas, CPA × alvo, ROAS, lucro),
// ritmo e projeção, alertas de rastreio. TS puro: tela do projeto e (depois) leituras, alertas e MCP usam a mesma regra.
//
// Cada número diz a fonte. Prioridade: pedidos/faturamento = webhook do checkout > Meta; visitas e checkout iniciado =
// tracker do Império > Meta; checkout preenchido = webhook (todo registro de venda, aprovada ou não); gasto = sync de anúncios.

import { cpaZone, ZONE_LABEL, type ScaleParams, type Zone } from "./scale-ladder.ts";

export type LiveSource = "tracker" | "webhook" | "meta" | "calculado";
export const SOURCE_LABEL: Record<LiveSource, string> = { tracker: "tracker", webhook: "checkout", meta: "Meta", calculado: "calculado" };

export interface SaleRow { status: string | null; valor: number | null; data?: unknown }
export interface AdRow { valor?: number | null; landing_page_views?: number | null; checkouts_iniciados?: number | null; init_checkout?: number | null; compras?: number | null; valor_conversao?: number | null; moeda?: string | null }

export interface LiveInput {
  /** Contagem de eventos do tracker no dia, por nome (PageView, InitiateCheckout…). */
  trackerEvents: Record<string, number>;
  sales: ReadonlyArray<SaleRow>;
  ads: ReadonlyArray<AdRow>;
  /** O checkout manda webhook para este projeto (venda nos últimos 30 dias). */
  webhookConnected: boolean;
  /** Parâmetros da Esteira de Escala do projeto (CPA alvo e payout), quando existem. */
  params?: ScaleParams | null;
  /** Fração do dia já passada (0–1), no fuso do projeto. */
  dayFraction: number;
  /** Saúde do sync de anúncios (adsSyncHealth), para explicar por que o gasto não chega. */
  syncHealth?: { estado: string; problemas: string[] } | null;
}

export interface LiveNumber { valor: number | null; fonte: LiveSource | null; /** Mesmo número pela outra fonte, quando as duas existem (ex.: Meta × checkout). */ outra?: { valor: number; fonte: LiveSource } | null }

const APPROVED = new Set(["aprovado", "approved", "paid", "completed"]);
const PENDING = new Set(["pix_gerado", "boleto_gerado", "pendente", "aguardando_pagamento", "pending"]);
const REFUNDED = new Set(["reembolsado", "chargeback", "refunded"]);

const num = (v: unknown) => { const x = typeof v === "number" ? v : Number(v); return Number.isFinite(x) ? x : 0; };
const round2 = (v: number) => Math.round(v * 100) / 100;
const sum = <T,>(rows: ReadonlyArray<T>, f: (r: T) => unknown) => round2(rows.reduce((s, r) => s + num(f(r)), 0));

function currencyOf(data: unknown): string | null {
  if (data && typeof data === "object" && "moeda" in data) {
    const m = (data as { moeda?: unknown }).moeda;
    if (typeof m === "string" && m.trim()) return m.trim().toUpperCase();
  }
  return null;
}

/** Checkouts iniciados da Meta: o sync grava em `init_checkout` (a coluna `checkouts_iniciados` chega zerada). */
export const adCheckouts = (a: { checkouts_iniciados?: number | null; init_checkout?: number | null }) => Math.max(num(a.checkouts_iniciados), num(a.init_checkout));

/** Primeira fonte com número > 0; sem nenhuma, a primeira que existe (com 0) ou nada. */
function pick(...options: Array<[LiveSource, number | null, boolean]>): LiveNumber {
  const live = options.filter(([, , available]) => available);
  const found = live.find(([, v]) => (v ?? 0) > 0) ?? live[0];
  return found ? { valor: found[1], fonte: found[0] } : { valor: null, fonte: null };
}

export function buildLivePanel(input: LiveInput) {
  const { sales, ads } = input;
  const hasAds = ads.length > 0;
  const approved = sales.filter((s) => APPROVED.has((s.status ?? "").toLowerCase()));
  const pending = sales.filter((s) => PENDING.has((s.status ?? "").toLowerCase()));
  const refunded = sales.filter((s) => REFUNDED.has((s.status ?? "").toLowerCase()));
  const ev = (name: string) => num(input.trackerEvents[name]);
  const hasTracker = Object.values(input.trackerEvents).some((v) => num(v) > 0);

  const moedas = new Set([...sales.map((s) => currencyOf(s.data)), ...ads.map((a) => a.moeda?.toUpperCase() ?? null)].filter((m): m is string => !!m));
  const moeda = moedas.size ? [...moedas][0] : "BRL";

  const visitas = pick(["tracker", ev("PageView"), hasTracker], ["meta", sum(ads, (a) => a.landing_page_views), hasAds]);
  const checkoutIniciado = pick(["tracker", ev("InitiateCheckout"), hasTracker], ["meta", sum(ads, adCheckouts), hasAds]);
  const checkoutPreenchido: LiveNumber = input.webhookConnected ? { valor: sales.length, fonte: "webhook" } : { valor: null, fonte: null };
  const pedidos = pick(["webhook", approved.length, input.webhookConnected], ["meta", sum(ads, (a) => a.compras), hasAds]);
  const faturamento = pick(["webhook", sum(approved, (s) => s.valor), input.webhookConnected], ["meta", sum(ads, (a) => a.valor_conversao), hasAds]);
  // Com checkout e Meta ao mesmo tempo, o card mostra os dois: divergência grande quase sempre é rastreio quebrado.
  if (input.webhookConnected && hasAds) {
    pedidos.outra = { valor: sum(ads, (a) => a.compras), fonte: "meta" };
    faturamento.outra = { valor: sum(ads, (a) => a.valor_conversao), fonte: "meta" };
  }
  const gasto: LiveNumber = hasAds ? { valor: sum(ads, (a) => a.valor), fonte: "meta" } : { valor: null, fonte: null };

  const etapas = [
    { key: "visitas", label: "Visitas", ...visitas },
    { key: "checkout_iniciado", label: "Checkout iniciado", ...checkoutIniciado },
    { key: "checkout_preenchido", label: "Checkout preenchido", ...checkoutPreenchido },
    { key: "pedidos", label: "Pedidos", ...pedidos },
  ].filter((e) => e.fonte !== null);
  const conversoes = etapas.slice(1).map((e, i) => {
    const prev = etapas[i];
    return { de: prev.key, para: e.key, taxa: prev.valor && e.valor !== null ? round2((e.valor / prev.valor) * 100) : null };
  });

  const vendas = pedidos.valor ?? 0;
  const g = gasto.valor;
  const fat = faturamento.valor ?? 0;
  const cpa = g !== null && g > 0 && vendas > 0 ? round2(g / vendas) : null;
  const zona: Zone | null = input.params && input.params.cpaAlvo > 0 && input.params.payout > 0 && g !== null ? cpaZone(cpa, input.params) : null;
  const frac = Math.min(1, Math.max(input.dayFraction, 0.01));

  const alertas: string[] = [];
  if (!input.webhookConnected) alertas.push("Checkout sem webhook no Império: pedidos e faturamento vêm do pixel da Meta (ou faltam).");
  if (input.syncHealth && input.syncHealth.estado !== "ok" && input.syncHealth.estado !== "sem_config") alertas.push(...input.syncHealth.problemas);
  else if (!hasAds) alertas.push("Sem gasto de anúncio sincronizado hoje: CPA, ROAS e lucro ficam sem base.");
  if (!hasTracker) alertas.push("Tracker do Império sem eventos hoje neste projeto: visitas e checkout vêm da Meta (ou faltam).");
  if (input.webhookConnected && hasAds) {
    const pixel = sum(ads, (a) => a.compras);
    const diff = Math.abs(pixel - approved.length);
    if (approved.length + pixel >= 5 && diff / Math.max(approved.length, pixel) > 0.2) {
      alertas.push(`Pixel da Meta (${pixel}) e checkout (${approved.length}) discordam em mais de 20%: conferir pixel/CAPI e UTMs.`);
    }
  }

  return {
    moeda,
    funil: { etapas, conversoes },
    parcial: {
      gasto,
      faturamento,
      vendas: pedidos,
      cpa: { valor: cpa, fonte: cpa !== null ? "calculado" as const : null, zona, zona_label: zona ? ZONE_LABEL[zona] : null, alvo: input.params?.cpaAlvo ?? null },
      roas: { valor: g && g > 0 ? round2(fat / g) : null, fonte: g && g > 0 ? "calculado" as const : null },
      lucro: { valor: g !== null ? round2(fat - g) : null, fonte: g !== null ? "calculado" as const : null },
      ticket: { valor: vendas > 0 ? round2(fat / vendas) : null, fonte: vendas > 0 ? "calculado" as const : null },
    },
    pendentes: { quantidade: pending.length, valor: sum(pending, (s) => s.valor) },
    reembolsos: { quantidade: refunded.length, valor: sum(refunded, (s) => s.valor) },
    ritmo: {
      vendas_por_hora: round2(vendas / (frac * 24)),
      projecao_vendas: Math.round(vendas / frac),
      projecao_faturamento: round2(fat / frac),
      projecao_gasto: g !== null ? round2(g / frac) : null,
    },
    alertas,
  };
}

export type LivePanel = ReturnType<typeof buildLivePanel>;

/** Linha de imphq_v_ads_sync_health (só status; nunca token). */
export interface AdsSyncHealthRow {
  meta_configurado?: boolean | null; meta_status?: string | null; meta_ultimo_sync?: string | null; meta_erro_codigo?: string | null; meta_erro?: string | null;
  zernio_configurado?: boolean | null; zernio_status?: string | null; zernio_ultimo_sync?: string | null; zernio_erro?: string | null;
  ultimo_dia_com_gasto?: string | null;
}

const STALE_HOURS = 36;
const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

/**
 * Saúde do sync de anúncios: erro declarado, sync parado (último sucesso há mais de 36 h) ou ok.
 * Token expirado da Meta (erro 190) vira instrução direta: só uma pessoa gera token novo.
 */
export function adsSyncHealth(row: AdsSyncHealthRow | null | undefined, now: number = Date.now()) {
  const problemas: string[] = [];
  if (!row || (!row.meta_configurado && !row.zernio_configurado)) {
    return { estado: "sem_config" as const, problemas: ["Nenhuma conta de anúncio ligada ao sync do Império."] };
  }
  const stale = (iso: string | null | undefined) => !iso || now - Date.parse(iso) > STALE_HOURS * 3600000;
  if (row.meta_configurado) {
    if (row.meta_erro_codigo === "190") problemas.push(`Token da Meta expirado${row.meta_ultimo_sync ? ` (último sync ok em ${dm(row.meta_ultimo_sync)})` : ""}: gerar token novo de usuário do sistema no Business Manager.`);
    else if (row.meta_status === "error") problemas.push(`Sync da Meta com erro: ${row.meta_erro ?? "sem detalhe"}.`);
    else if (stale(row.meta_ultimo_sync)) problemas.push(`Sync da Meta parado${row.meta_ultimo_sync ? ` desde ${dm(row.meta_ultimo_sync)}` : ""}.`);
  }
  if (row.zernio_configurado) {
    if (row.zernio_status === "error") problemas.push(`Sync do Zernio com erro: ${row.zernio_erro ?? "sem detalhe"}.`);
    else if (stale(row.zernio_ultimo_sync)) problemas.push(`Sync do Zernio sem sucesso${row.zernio_ultimo_sync ? ` desde ${dm(row.zernio_ultimo_sync)}` : ""}: conferir a conta de anúncio ligada no Zernio.`);
  }
  // Um caminho funcionando basta para o gasto chegar.
  const metaOk = !!row.meta_configurado && row.meta_status !== "error" && !stale(row.meta_ultimo_sync);
  const zernioOk = !!row.zernio_configurado && row.zernio_status !== "error" && !stale(row.zernio_ultimo_sync);
  const estado = metaOk || zernioOk ? "ok" as const : problemas.some((p) => p.includes("erro") || p.includes("expirado")) ? "erro" as const : "parado" as const;
  if (row.ultimo_dia_com_gasto) problemas.push(`Último dia com gasto registrado: ${dm(row.ultimo_dia_com_gasto)}.`);
  return { estado, problemas: estado === "ok" ? [] : problemas };
}

/** Variação entre duas leituras (para "vs leitura anterior"). */
export function liveDelta(now: LivePanel, before: LivePanel | null) {
  if (!before) return null;
  const d = (a: number | null, b: number | null) => (a !== null && b !== null ? round2(a - b) : null);
  return {
    gasto: d(now.parcial.gasto.valor, before.parcial.gasto.valor),
    faturamento: d(now.parcial.faturamento.valor, before.parcial.faturamento.valor),
    vendas: d(now.parcial.vendas.valor, before.parcial.vendas.valor),
    cpa: d(now.parcial.cpa.valor, before.parcial.cpa.valor),
    roas: d(now.parcial.roas.valor, before.parcial.roas.valor),
    lucro: d(now.parcial.lucro.valor, before.parcial.lucro.valor),
  };
}

/** Fração do dia já passada num fuso fixo (padrão Brasília, UTC-3). */
export function dayFraction(now: Date = new Date(), offsetHours = -3): number {
  const local = new Date(now.getTime() + offsetHours * 3600000);
  return (local.getUTCHours() * 3600 + local.getUTCMinutes() * 60 + local.getUTCSeconds()) / 86400;
}

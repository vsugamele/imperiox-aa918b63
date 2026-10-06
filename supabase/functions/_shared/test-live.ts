// Leitura ao vivo de um teste de criativos (TST1.3): cruza o gasto por anúncio que o Zernio grava em imphq_ads_spend
// com as vendas reais (Ticto, por UTM) e monta o relatório do WhatsApp. TS puro, usado pelo painel e pela função.
import { evaluateTestOrder } from "./test-order.ts";

export interface LiveOrder {
  nome: string;
  oferta: string;
  status: string;
  utm_campaign: string;
  payout: number;
  cpa_alvo: number;
  ics_por_venda?: number | null;
  verba_dia_conjunto: number;
  ativado_em?: string | null;
}

export interface LiveVariant { ordem: number; angulo: string; hipotese?: string | null; status: string; utm_content: string; meta_ad_id?: string | null }

/** Linha diária por anúncio vinda do Zernio (imphq_ads_spend). */
export interface SpendRow {
  ad_id: string | null;
  spend: number | string | null;
  init_checkout?: number | null;
  link_clicks?: number | null;
  impressoes?: number | null;
  purchases?: number | null;
  effective_status?: string | null;
  created_at?: string | null;
}

/** Venda da plataforma (imphq_vendas). */
export interface SaleRow { utm_campaign: string | null; utm_content: string | null; status: string | null; valor?: number | string | null; valor_liquido?: number | string | null }

export interface LiveReading {
  ordem: number;
  gasto: number;
  ic: number;
  cliques: number;
  impressoes: number;
  ctr: number | null;
  compras_pixel: number;
  vendas: number;
  receita_liquida: number;
  cpa: number | null;
  status_meta: string | null;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const PAID = new Set(["aprovado", "approved", "paid", "pago", "completed"]);

/** A UTM chega como "01-medo::<fbclid>": vale só o que vem antes de "::". */
export function saleContent(utmContent: string | null | undefined): string {
  return String(utmContent ?? "").split("::")[0].trim().toLowerCase();
}

export function liveReadings(order: Pick<LiveOrder, "utm_campaign">, variants: ReadonlyArray<LiveVariant>, spend: ReadonlyArray<SpendRow>, sales: ReadonlyArray<SaleRow>): LiveReading[] {
  return variants.map((v) => {
    const rows = v.meta_ad_id ? spend.filter((r) => r.ad_id === v.meta_ad_id) : [];
    const gasto = round2(rows.reduce((s, r) => s + num(r.spend), 0));
    const cliques = rows.reduce((s, r) => s + num(r.link_clicks), 0);
    const impressoes = rows.reduce((s, r) => s + num(r.impressoes), 0);
    const vendidas = sales.filter((s) => s.utm_campaign === order.utm_campaign && saleContent(s.utm_content) === v.utm_content.toLowerCase() && PAID.has(String(s.status ?? "").toLowerCase()));
    const latest = [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
    return {
      ordem: v.ordem,
      gasto,
      ic: rows.reduce((s, r) => s + num(r.init_checkout), 0),
      cliques,
      impressoes,
      ctr: impressoes ? round2((cliques / impressoes) * 100) : null,
      compras_pixel: rows.reduce((s, r) => s + num(r.purchases), 0),
      vendas: vendidas.length,
      receita_liquida: round2(vendidas.reduce((s, x) => s + num(x.valor_liquido ?? x.valor), 0)),
      cpa: vendidas.length ? round2(gasto / vendidas.length) : null,
      status_meta: latest?.effective_status ?? null,
    };
  });
}

/** Momento da última sincronização do Zernio entre as linhas usadas. */
export function lastSync(spend: ReadonlyArray<SpendRow>): string | null {
  return spend.reduce<string | null>((m, r) => (r.created_at && (!m || r.created_at > m) ? r.created_at : m), null);
}

/**
 * Veredito ao vivo pela Esteira. Vendas = só as reais da plataforma: o pixel (via Zernio) contou o dobro das compras
 * no teste do CCP em 05/10, então ele aparece como informação e não decide.
 */
export function liveEvaluation(order: LiveOrder, variants: ReadonlyArray<LiveVariant>, readings: ReadonlyArray<LiveReading>, now: Date) {
  const dias = order.ativado_em ? Math.max(0, (now.getTime() - Date.parse(order.ativado_em)) / 86_400_000) : 0;
  return {
    dias,
    ...evaluateTestOrder(order, variants, readings.map((r) => ({ ordem: r.ordem, gasto: r.gasto, ic: r.ic, vendas: r.vendas })), dias),
  };
}

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function brt(iso: string): string {
  const d = new Date(Date.parse(iso) - 3 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export type LiveLabel = "vendendo" | "ic_barato" | "pausar" | "aguardando" | "parado";

/** A Esteira chama de "qualificado" o ângulo com IC barato; só é vencedor de fato quem já vendeu. */
export function liveLabel(decisao: string, vendas: number): LiveLabel {
  if (decisao === "ja_parado") return "parado";
  if (decisao === "pausar") return "pausar";
  if (vendas > 0) return "vendendo";
  return decisao === "vencedor" ? "ic_barato" : "aguardando";
}

export const LIVE_LABEL: Record<LiveLabel, { icon: string; texto: string }> = {
  vendendo: { icon: "🏆", texto: "vendendo" },
  ic_barato: { icon: "🟢", texto: "IC barato, sem venda ainda" },
  aguardando: { icon: "🟡", texto: "aguardando dados" },
  pausar: { icon: "🔴", texto: "pausar" },
  parado: { icon: "⏸️", texto: "parado" },
};

/** Texto do relatório para o grupo (WhatsApp: *negrito*, uma linha por ângulo, do melhor para o pior). */
export function testReportText(order: LiveOrder, variants: ReadonlyArray<LiveVariant>, readings: ReadonlyArray<LiveReading>, sync: string | null, now: Date): string {
  const ev = liveEvaluation(order, variants, readings, now);
  const byOrdem = new Map(readings.map((r) => [r.ordem, r]));
  const gasto = round2(readings.reduce((s, r) => s + r.gasto, 0));
  const vendas = readings.reduce((s, r) => s + r.vendas, 0);
  const liquido = round2(readings.reduce((s, r) => s + r.receita_liquida, 0));
  const pixel = readings.reduce((s, r) => s + r.compras_pixel, 0);
  const linhas = [...ev.avaliacoes]
    .sort((a, b) => (byOrdem.get(b.ordem)?.vendas ?? 0) - (byOrdem.get(a.ordem)?.vendas ?? 0) || (byOrdem.get(b.ordem)?.ic ?? 0) - (byOrdem.get(a.ordem)?.ic ?? 0))
    .map((a) => {
      const r = byOrdem.get(a.ordem);
      const v = variants.find((x) => x.ordem === a.ordem);
      const pausadoMeta = r?.status_meta && r.status_meta !== "ACTIVE" ? " (pausado na Meta)" : "";
      return `${LIVE_LABEL[liveLabel(a.decisao, r?.vendas ?? 0)].icon} ${String(a.ordem).padStart(2, "0")} ${v?.angulo ?? a.angulo}${pausadoMeta}: ${brl(r?.gasto ?? 0)} · ${r?.ic ?? 0} IC · ${r?.vendas ?? 0} venda(s)${r?.cpa ? ` · CPA ${brl(r.cpa)}` : ""}`;
    });
  const grupo = (label: LiveLabel, titulo: string) => {
    const ordens = ev.avaliacoes.filter((a) => liveLabel(a.decisao, byOrdem.get(a.ordem)?.vendas ?? 0) === label).map((a) => String(a.ordem).padStart(2, "0"));
    return ordens.length ? `${LIVE_LABEL[label].icon} ${titulo}: ${ordens.join(", ")}.` : "";
  };
  const proximos = [
    grupo("vendendo", "Vendendo"),
    grupo("ic_barato", "IC barato, sem venda ainda"),
    ev.pausar.length ? `Para pausar: ${ev.pausar.map((o) => String(o).padStart(2, "0")).join(", ")} (só com corte autorizado ou OK de vocês).` : "",
    ev.dias < 2 ? `Dia ${Math.max(1, Math.ceil(ev.dias))} de teste: a Esteira só corta a partir do fim do dia 2.` : "",
  ].filter(Boolean);
  return [
    `*📊 Teste de criativos · ${order.nome}*`,
    `${order.oferta} · ${ev.dias.toFixed(1)} dia(s) no ar`,
    "",
    `Gasto: *${brl(gasto)}* · Vendas reais: *${vendas}* · CPA: *${vendas ? brl(gasto / vendas) : "—"}*`,
    `Líquido: ${brl(liquido)} · Saldo: ${brl(liquido - gasto)}`,
    pixel !== vendas ? `Pixel diz ${pixel} compra(s); vale a venda da plataforma.` : "",
    "",
    ...linhas,
    "",
    ...proximos,
    `_Gasto do Zernio até ${sync ? brt(sync) : "—"} · vendas até agora · painel: imperiox.vercel.app/testes_`,
  ].filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

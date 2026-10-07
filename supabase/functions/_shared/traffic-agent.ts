// Agente de tráfego (TRF1.1): lê o gasto por anúncio (Zernio, 7 dias), liga as vendas a cada anúncio e decide pela
// Esteira de Escala (CPA alvo e payout do projeto). TS puro: a function traffic-agent busca os dados e executa.
//
// Autonomia (Vinicius, 07/10): pausa SOZINHO só prejuízo claro — anúncio ativo com gasto ≥ 3× o CPA alvo e nenhuma
// venda — e avisa. Pausa com venda, ou gasto entre 2× e 3× sem venda, vira proposta (OK no grupo). Escalar é sempre
// recomendação (o orçamento é do conjunto/campanha e o sync não traz o orçamento). Também ranqueia os ofensores e
// sugere alternativas (duplicar e gerar variações do vencedor, ou ângulos novos quando ninguém está na meta).

import { cpaZone, ZONE_LABEL, type ScaleParams, type Zone } from "./scale-ladder.ts";

export interface AdDayRow {
  ad_id: string | null; anuncio: string | null; campaign_id?: string | null; campanha?: string | null;
  valor: number | string | null; compras?: number | string | null; init_checkout?: number | string | null;
  link_clicks?: number | string | null; effective_status?: string | null; data_ref: string;
}
export interface AdSale { utm_campaign: string | null; utm_content: string | null; status: string | null; tipo_venda?: string | null }

export interface AdStats {
  ad_id: string; nome: string; campanha: string | null; status: string;
  /** Vendas reais do checkout ligadas ao anúncio pela UTM (sem bump). O pixel fica só como referência. */
  gasto: number; vendas: number; pixel: number; ic: number; cliques: number;
  dias_com_gasto: number; dias_sem_gastar: number;
}

const n = (v: unknown) => { const x = typeof v === "number" ? v : Number(v); return Number.isFinite(x) ? x : 0; };
const round2 = (v: number) => Math.round(v * 100) / 100;
const PAID = new Set(["aprovado", "approved", "paid", "completed"]);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Chave da UTM de conteúdo: o que vem antes de "::" ("07-publico::PAZ…" → "07-publico"). */
export function contentKey(utmContent: string | null | undefined): string {
  return norm((utmContent ?? "").split("::")[0].trim());
}

/** O anúncio casa com a UTM quando o nome traz o mesmo número e a mesma palavra ("CCP 07 publico — …" ↔ "07-publico"). */
export function adMatchesContent(adName: string, key: string): boolean {
  const m = /^(\d{1,3})-([a-z0-9]+)/.exec(key);
  if (!m) return false;
  const name = norm(adName);
  return new RegExp(`(^|\\D)0*${Number(m[1])}(\\D|$)`).test(name) && name.includes(m[2]);
}

/**
 * Números de 7 dias por anúncio. Vendas = só as reais do checkout ligadas pela UTM, sem order bump (Vinicius, 07/10:
 * o pixel duplica — 26 compras no pixel × 8 vendas reais em 06/10). Linhas sem anúncio (só campanha) ficam de fora.
 */
export function adStats(rows: ReadonlyArray<AdDayRow>, sales: ReadonlyArray<AdSale>, today: string): AdStats[] {
  const byAd = new Map<string, AdDayRow[]>();
  for (const r of rows) {
    if (!r.ad_id || r.ad_id.startsWith("CAMP:")) continue;
    byAd.set(r.ad_id, [...(byAd.get(r.ad_id) ?? []), r]);
  }
  const paidKeys = sales.filter((s) => PAID.has((s.status ?? "").toLowerCase()) && !/bump/i.test(s.tipo_venda ?? "")).map((s) => contentKey(s.utm_content)).filter(Boolean);
  const out: AdStats[] = [];
  for (const [adId, list] of byAd) {
    const sorted = list.slice().sort((a, b) => a.data_ref.localeCompare(b.data_ref));
    const last = sorted[sorted.length - 1];
    const nome = sorted.map((r) => r.anuncio).filter(Boolean).pop() ?? adId;
    const gasto = round2(sorted.reduce((s, r) => s + n(r.valor), 0));
    const pixel = sorted.reduce((s, r) => s + n(r.compras), 0);
    const utm = paidKeys.filter((k) => adMatchesContent(nome, k)).length;
    const withSpend = sorted.filter((r) => n(r.valor) > 0).map((r) => r.data_ref);
    const lastSpend = withSpend[withSpend.length - 1];
    out.push({
      ad_id: adId, nome, campanha: last.campanha ?? null, status: (last.effective_status ?? "").toUpperCase(),
      gasto, vendas: utm, pixel,
      ic: sorted.reduce((s, r) => s + n(r.init_checkout), 0), cliques: sorted.reduce((s, r) => s + n(r.link_clicks), 0),
      dias_com_gasto: withSpend.length,
      dias_sem_gastar: lastSpend ? Math.max(0, Math.round((Date.parse(today) - Date.parse(lastSpend)) / 86400000)) : 7,
    });
  }
  return out.sort((a, b) => b.gasto - a.gasto);
}

/** Vendas reais (sem bump) da campanha que não casaram com nenhum anúncio: aparecem no relatório, não somem. */
export function unattributedSales(stats: ReadonlyArray<AdStats>, sales: ReadonlyArray<AdSale>): number {
  const real = sales.filter((s) => PAID.has((s.status ?? "").toLowerCase()) && !/bump/i.test(s.tipo_venda ?? ""));
  return Math.max(0, real.length - stats.reduce((sum, a) => sum + a.vendas, 0));
}

export type TrafficAction = "pausar_auto" | "pausar" | "escalar" | "observar" | "manter";
export interface TrafficDecision { ad_id: string; nome: string; acao: TrafficAction; zona: Zone; cpa: number | null; motivo: string }
export interface TrafficOffender { ad_id: string; nome: string; desperdicio: number; gasto: number; vendas: number }
export interface TrafficAlternative { tipo: "duplicar_vencedor" | "variacoes_do_vencedor" | "angulos_novos"; ad_id: string | null; texto: string }

const ACTIVE = new Set(["ACTIVE", "ATIVO", ""]);

export function trafficPlan(stats: ReadonlyArray<AdStats>, p: ScaleParams, currency = "BRL") {
  const money = (v: number | null) => {
    if (v === null) return "—";
    try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v); } catch { return `${currency} ${v.toFixed(2)}`; }
  };
  const decisoes: TrafficDecision[] = [];
  for (const s of stats) {
    const cpa = s.vendas > 0 ? round2(s.gasto / s.vendas) : null;
    const zona = cpaZone(cpa, p);
    const ativo = ACTIVE.has(s.status);
    const base = { ad_id: s.ad_id, nome: s.nome, zona, cpa };
    if (!ativo) continue;
    if (s.vendas === 0 && s.gasto >= 3 * p.cpaAlvo) {
      decisoes.push({ ...base, acao: "pausar_auto", motivo: `${money(s.gasto)} em 7 dias e nenhuma venda (≥ 3× o CPA alvo de ${money(p.cpaAlvo)})` });
    } else if (s.vendas === 0 && s.gasto >= 2 * p.cpaAlvo) {
      decisoes.push({ ...base, acao: "pausar", motivo: `${money(s.gasto)} em 7 dias e nenhuma venda (≥ 2× o CPA alvo)` });
    } else if (zona === "prejuizo" && s.gasto >= 2 * p.cpaAlvo) {
      decisoes.push({ ...base, acao: "pausar", motivo: `CPA ${money(cpa)} (${ZONE_LABEL[zona]}) acima do payout ${money(p.payout)} em ${s.vendas} venda(s)` });
    } else if (zona === "escala" && s.vendas >= 3) {
      decisoes.push({ ...base, acao: "escalar", motivo: `CPA ${money(cpa)} (${ZONE_LABEL[zona]}) com ${s.vendas} vendas: subir ~20% o orçamento do conjunto (uma mexida por dia)` });
    } else if (zona === "magra") {
      decisoes.push({ ...base, acao: "observar", motivo: `CPA ${money(cpa)} (${ZONE_LABEL[zona]}): só vale com volume` });
    } else {
      decisoes.push({ ...base, acao: "manter", motivo: s.vendas ? `CPA ${money(cpa)} (${ZONE_LABEL[zona]})` : `${money(s.gasto)} gastos, ainda abaixo de 2× o CPA alvo` });
    }
  }

  // Ofensores: quanto cada anúncio gastou além do que as vendas dele justificam pelo CPA alvo.
  const ofensores: TrafficOffender[] = stats
    .map((s) => ({ ad_id: s.ad_id, nome: s.nome, gasto: s.gasto, vendas: s.vendas, desperdicio: round2(s.gasto - s.vendas * p.cpaAlvo) }))
    .filter((o) => o.desperdicio > 0)
    .sort((a, b) => b.desperdicio - a.desperdicio)
    .slice(0, 3);

  const vencedores = stats.filter((s) => s.vendas >= 2 && (cpaZone(s.gasto / s.vendas, p) === "escala" || cpaZone(s.gasto / s.vendas, p) === "lucrativa"));
  const alternativas: TrafficAlternative[] = [];
  if (vencedores.length) {
    const top = vencedores.slice().sort((a, b) => a.gasto / a.vendas - b.gasto / b.vendas)[0];
    alternativas.push({ tipo: "duplicar_vencedor", ad_id: top.ad_id, texto: `Duplicar "${top.nome}" (CPA ${money(round2(top.gasto / top.vendas))}) num conjunto novo no lugar dos pausados` });
    alternativas.push({ tipo: "variacoes_do_vencedor", ad_id: top.ad_id, texto: `Gerar 3 variações de "${top.nome}" na fábrica de criativos (mesmo ângulo, ganchos novos)` });
  } else if (stats.some((s) => s.gasto > 0)) {
    alternativas.push({ tipo: "angulos_novos", ad_id: null, texto: "Nenhum anúncio na meta: montar um P1 com hipóteses novas a partir da biblioteca de referências (anúncios de concorrentes que rodam há mais tempo)" });
  }

  return {
    decisoes,
    ofensores,
    alternativas,
    resumo: {
      anuncios: stats.length,
      gasto: round2(stats.reduce((s, a) => s + a.gasto, 0)),
      vendas: stats.reduce((s, a) => s + a.vendas, 0),
      pausar_auto: decisoes.filter((d) => d.acao === "pausar_auto").length,
      propostas: decisoes.filter((d) => d.acao === "pausar").length,
      escalar: decisoes.filter((d) => d.acao === "escalar").length,
    },
  };
}

export type TrafficPlan = ReturnType<typeof trafficPlan>;

/**
 * Aviso do agente no grupo Imperio X. `pausados` = o que ele pausou sozinho agora; `propostas` = o que entrou na fila
 * (decidido com "ok N" na rodada do operador). Sem nada além de "manter", devolve texto vazio (não manda).
 */
export function trafficMessage(input: {
  projeto: string; plan: TrafficPlan; currency?: string; semAnuncio: number;
  pausados: ReadonlyArray<{ nome: string; motivo: string }>; falhas: ReadonlyArray<{ nome: string; erro: string }>;
  propostas: number; appUrl: string;
}): string {
  const { plan } = input;
  const money = (v: number) => {
    try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: input.currency ?? "BRL" }).format(v); } catch { return v.toFixed(2); }
  };
  const escalar = plan.decisoes.filter((d) => d.acao === "escalar");
  const observar = plan.decisoes.filter((d) => d.acao === "observar");
  const lines: string[] = [];
  for (const p of input.pausados) lines.push(`⏸️ Pausei sozinho: *${p.nome}* — ${p.motivo}`);
  for (const f of input.falhas) lines.push(`⚠️ Tentei pausar *${f.nome}* e falhou: ${f.erro}`);
  if (input.propostas) lines.push(`🟠 ${input.propostas} pausa(s) para decidir — vão numeradas na próxima rodada do operador (responder "ok N").`);
  for (const e of escalar) lines.push(`🟢 Escalar: *${e.nome}* — ${e.motivo}`);
  for (const o of observar) lines.push(`👀 Observar: *${o.nome}* — ${o.motivo}`);
  if (plan.ofensores.length) lines.push(`💸 Ofensores (gasto além do CPA alvo): ${plan.ofensores.map((o) => `${o.nome} ${money(o.desperdicio)}`).join(" · ")}`);
  if (!lines.length) return "";
  for (const a of plan.alternativas) lines.push(`💡 ${a.texto}`);
  if (input.semAnuncio) lines.push(`ℹ️ ${input.semAnuncio} venda(s) com UTM que não casou com nenhum anúncio (conferir nomes/UTMs).`);
  const r = plan.resumo;
  return [
    `📈 *Tráfego — ${input.projeto}* (7 dias, vendas reais do checkout)`,
    `${r.anuncios} anúncios · ${money(r.gasto)} gastos · ${r.vendas} vendas${r.vendas ? ` · CPA ${money(r.gasto / r.vendas)}` : ""}`,
    "",
    ...lines,
    "",
    `Desfazer pausa: ${input.appUrl}/imperius`,
  ].join("\n");
}

// Método H&W (MHW1.4): política de tráfego "Método CBO" (P1 testa, P2 escala). Alternativa à política atual do agente de
// tráfego (múltiplos do CPA alvo), escolhida por projeto em imphq_scale_rounds.params.politica = "cbo_hw".
// Os cortes acompanham o payout (o que entra por venda): ~32% sem IC, ~45% com menos de 2 IC, ~85% sem venda.
// TS puro: decide e explica; quem executa (ou só propõe) é o traffic-agent, conforme a autonomia do projeto.

export interface CboParams {
  /** O que entra por venda (ticket líquido + bump médio). JP Código dos Cortes ≈ R$59. */
  payout: number;
  /** CPC acima disto corta, salvo venda com ROAS ≥ 1. Opcional. */
  cpcMax?: number | null;
  /** Vídeo para VSL: CPC ~30% e IC ~50% mais caros, então a escada sobe 30%. */
  formato?: "imagem" | "video";
  horasMinimas?: number;
  vendasValidacao?: number;
  vendasViraEscala?: number;
}

export interface CboAd {
  ad_id: string; nome: string; gasto: number; ic: number; vendas: number; cliques: number;
  /** Horas desde o primeiro dia com gasto (para a regra de não mexer antes de 48h). */
  horas_no_ar: number;
}

export type CboAcao = "cortar" | "manter" | "aguardar" | "validado" | "vira_escala";
export interface CboDecision { ad_id: string; nome: string; acao: CboAcao; regra: string; motivo: string; cpa: number | null }

const r2 = (v: number) => Math.round(v * 100) / 100;

export function cboCuts(p: CboParams) {
  const f = p.formato === "video" ? 1.3 : 1;
  return { semIc: r2(0.32 * p.payout * f), poucoIc: r2(0.45 * p.payout * f), limite: r2(0.85 * p.payout * f) };
}

export function cboDecide(ad: CboAd, p: CboParams, money: (v: number) => string = (v) => v.toFixed(2)): CboDecision {
  const cut = cboCuts(p);
  const horas = p.horasMinimas ?? 48;
  const validacao = p.vendasValidacao ?? 3;
  const viraEscala = p.vendasViraEscala ?? 4;
  const cpa = ad.vendas > 0 ? r2(ad.gasto / ad.vendas) : null;
  const cpc = ad.cliques > 0 ? ad.gasto / ad.cliques : null;
  const roasOk = ad.vendas > 0 && ad.vendas * p.payout >= ad.gasto;
  const base = { ad_id: ad.ad_id, nome: ad.nome, cpa };

  // Escada de cortes da P1: vale a qualquer hora (é limite de gasto, não leitura).
  if (ad.vendas === 0 && ad.ic === 0 && ad.gasto >= cut.semIc) return { ...base, acao: "cortar", regra: "corte_1", motivo: `${money(ad.gasto)} sem nenhum checkout iniciado (corte 1: ${money(cut.semIc)}, ~32% do payout)` };
  if (ad.vendas === 0 && ad.ic < 2 && ad.gasto >= cut.poucoIc) return { ...base, acao: "cortar", regra: "corte_2", motivo: `${money(ad.gasto)} com ${ad.ic} checkout iniciado (corte 2: ${money(cut.poucoIc)}, ~45% do payout)` };
  if (ad.vendas === 0 && ad.gasto >= cut.limite) return { ...base, acao: "cortar", regra: "limite", motivo: `${money(ad.gasto)} com ${ad.ic} checkouts e nenhuma venda (limite: ${money(cut.limite)}, ~85% do payout)` };
  if (p.cpcMax && cpc !== null && cpc > p.cpcMax && !roasOk) return { ...base, acao: "cortar", regra: "cpc", motivo: `CPC ${money(cpc)} acima do teto ${money(p.cpcMax)} sem venda que pague` };

  // Validar é ler o consolidado, e só depois de 48h.
  if (ad.horas_no_ar < horas) return { ...base, acao: "aguardar", regra: "48h", motivo: `${Math.floor(ad.horas_no_ar)}h no ar: leitura só depois de ${horas}h` };
  if (cpa !== null && cpa <= p.payout && ad.vendas >= viraEscala) return { ...base, acao: "vira_escala", regra: "p1_escala", motivo: `${ad.vendas} vendas a CPA ${money(cpa)}: a própria P1 pode virar escala (sem bid, +30% só na virada do dia) e abre-se uma P1 nova ao lado` };
  if (cpa !== null && cpa <= p.payout && ad.vendas >= validacao) return { ...base, acao: "validado", regra: "validado", motivo: `${ad.vendas} vendas a CPA ${money(cpa)} (≤ payout ${money(p.payout)}): vai para a P2` };
  if (cpa !== null && cpa > p.payout && ad.vendas >= 2) return { ...base, acao: "cortar", regra: "cpa", motivo: `CPA ${money(cpa)} acima do payout ${money(p.payout)} em ${ad.vendas} vendas` };
  return { ...base, acao: "manter", regra: "manter", motivo: ad.vendas ? `${ad.vendas} venda(s) a CPA ${money(cpa ?? 0)}: uma venda é sinal, não prova` : `${money(ad.gasto)} gastos, ${ad.ic} checkout(s): dentro da escada` };
}

export interface P2Plan {
  estrutura: string;
  orcamento_referencia: number;
  bid_min: number;
  bid_max: number;
  /** Se o bid travar: 4 campanhas extras, cada degrau ~23% do payout acima do anterior. */
  degraus_bid: number[];
  regras: string[];
}

/** Receita da P2 para os validados (recomendação; quem monta a estrutura é humano ou o Lançador). */
export function p2Plan(validados: number, p: CboParams): P2Plan {
  const passo = 0.227 * p.payout;
  return {
    estrutura: `1-5-${Math.max(1, validados)}`,
    orcamento_referencia: r2(10 * p.payout),
    bid_min: r2(0.7 * p.payout),
    bid_max: r2(p.payout),
    degraus_bid: [0, 1, 2, 3].map((k) => r2(p.payout + k * passo)),
    regras: [
      "Um 1-5-1 por criativo validado.",
      "Aumentar orçamento só com estabilidade; se derrubar o resultado, reduzir ou lateralizar.",
      "P1 que virou escala: sem bid, +30% só na virada do dia.",
      "Subir a mesma estrutura em pelo menos 3 contas e comparar também por conta.",
      "Conta limitando gasto: avaliar pagamento adiantado (decisão do sócio).",
    ],
  };
}

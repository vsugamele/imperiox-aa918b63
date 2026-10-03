// Esteira de Escala DTC (metodologia DTC Affiliate, @gbifi, trazida do AffHub): regras de veredito de cada fase.
// TS puro: playbook "esteira-escala-dtc", MCP evaluate_scale, contexto da IA e (depois) a etapa do mapa usam a mesma regra.
//
// P1 teste de concepts (ABO 1-5-3, 2 dias) → P2 rodada de primary text (ABO 1-5-10, 3 dias)
// → P3 escala (CBO com bid cap, 1 conjunto por ângulo) → P4 cemitério (CBO 1-1-10 com cost cap).

export interface ScaleParams {
  /** Quanto entra por venda (comissão do afiliado ou margem bruta do produto). É o breakeven do CPA. */
  payout: number;
  /** CPA que se quer pagar. */
  cpaAlvo: number;
  /** Checkouts iniciados (IC) para cada venda; padrão 8. */
  icsPorVenda?: number;
}

export type Zone = "sem_venda" | "escala" | "lucrativa" | "magra" | "prejuizo";

export interface Verdict<T extends string> { veredito: T; rotulo: string; acao: string }

export const ZONE_LABEL: Record<Zone, string> = {
  sem_venda: "SEM VENDA", escala: "ESCALA", lucrativa: "LUCRATIVA", magra: "MAGRA", prejuizo: "PREJUÍZO",
};

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const round2 = (v: number) => Math.round(v * 100) / 100;
const ics = (p: ScaleParams) => (p.icsPorVenda && p.icsPorVenda > 0 ? p.icsPorVenda : 8);

/** Números que saem dos parâmetros: tetos, lances e verba de referência de cada fase. */
export function deriveParams(p: ScaleParams) {
  const tetoIc = p.cpaAlvo / ics(p);
  return {
    breakeven: round2(p.payout),
    margem_no_alvo: round2(p.payout - p.cpaAlvo),
    roas_alvo: p.cpaAlvo ? round2(p.payout / p.cpaAlvo) : null,
    teto_custo_ic_qualificado: round2(tetoIc),
    teto_custo_ic_mais_textos: round2(tetoIc * 1.75),
    custo_ic_breakeven: round2(p.payout / ics(p)),
    lance_inicial_p3: round2(p.cpaAlvo * 0.6),
    teto_economico: round2(p.payout * 0.8),
    cost_cap_p4: round2(p.cpaAlvo * 0.7),
    verba_referencia_p1: round2(p.cpaAlvo * 10),
    verba_referencia_p2: round2(p.cpaAlvo * 15),
  };
}

/** Zona do CPA: ≤ alvo escala; ≤ 80% do payout lucrativa; ≤ payout magra; acima disso prejuízo. */
export function cpaZone(cpa: number | null, p: ScaleParams): Zone {
  if (cpa === null || !Number.isFinite(cpa)) return "sem_venda";
  if (cpa <= p.cpaAlvo) return "escala";
  if (cpa <= p.payout * 0.8) return "lucrativa";
  if (cpa <= p.payout) return "magra";
  return "prejuizo";
}

const cpaOf = (gasto: number, vendas: number) => (vendas > 0 ? gasto / vendas : null);

// ── P1: teste de concepts ────────────────────────────────────────────────────

export type ConceptVerdict = "aguarda" | "qualificado" | "mais_textos" | "morto" | "cedo";
export interface ConceptInput { concept?: string; hipotese?: string; gasto: number | string; ic: number | string; vendas: number | string }

/** Veredito do concept no fim do dia 2, pelo custo por checkout iniciado (IC). */
export function evaluateConcept(row: ConceptInput, p: ScaleParams): Verdict<ConceptVerdict> & { custo_por_ic: number | null } {
  const g = n(row.gasto), ic = n(row.ic), v = n(row.vendas);
  const d = deriveParams(p);
  const custo = ic > 0 && g > 0 ? round2(g / ic) : null;
  const out = (veredito: ConceptVerdict, rotulo: string, acao: string) => ({ veredito, rotulo, acao, custo_por_ic: custo });
  if (!g) return out("aguarda", "AGUARDA", "Preenche o gasto no fim do dia 2.");
  if (v > 0 || (custo !== null && custo <= d.teto_custo_ic_qualificado)) return out("qualificado", "QUALIFICADO", "Vai para o P2 em ABO 1-5-10 com esse concept.");
  if (custo !== null && custo <= d.teto_custo_ic_mais_textos) return out("mais_textos", "MAIS TEXTOS", "O concept respira: produz mais primary texts e roda de novo.");
  if (custo === null && g >= d.teto_custo_ic_mais_textos * 2) return out("morto", "MATA", "Gastou sem nenhum IC. Mata o concept.");
  if (custo === null) return out("cedo", "CEDO", "Sem IC ainda e gasto baixo: espera completar os 2 dias.");
  return out("morto", "MATA", "Custo por IC acima do teto. Mata o concept.");
}

export type HypothesisResult = "confirmada" | "parcial" | "refutada";
const HYPOTHESIS: Partial<Record<ConceptVerdict, HypothesisResult>> = { qualificado: "confirmada", mais_textos: "parcial", morto: "refutada" };

/** Rodada do P1 inteira: resumo e o placar de hipóteses (o que o mercado confirmou ou derrubou). */
export function evaluateP1Round(rows: ReadonlyArray<ConceptInput>, p: ScaleParams) {
  const linhas = rows.filter((r) => r.concept || n(r.gasto)).map((r) => ({ concept: r.concept ?? "", hipotese: r.hipotese ?? "", ...evaluateConcept(r, p) }));
  const investimento = round2(rows.reduce((s, r) => s + n(r.gasto), 0));
  const qualificados = linhas.filter((l) => l.veredito === "qualificado").length;
  return {
    linhas,
    investimento,
    qualificados,
    mais_textos: linhas.filter((l) => l.veredito === "mais_textos").length,
    mortos: linhas.filter((l) => l.veredito === "morto").length,
    custo_por_qualificado: qualificados ? round2(investimento / qualificados) : null,
    placar_hipoteses: linhas.flatMap((l) => {
      const resultado = HYPOTHESIS[l.veredito];
      return l.hipotese && resultado ? [{ hipotese: l.hipotese, concept: l.concept, resultado }] : [];
    }),
    regra: "Hipótese refutada só volta se a premissa mudar, não com criativo novo. Hipótese confirmada vira eixo de variação (avatar → headline → hook empilhado → fatia de público).",
  };
}

// ── P2: rodada de primary text ───────────────────────────────────────────────

export type P2Reading = "nao_julga" | "aprovado" | "estende" | "reprovado";

/** Diário agregado dos 5 conjuntos: só julga no dia 3, pelo CPA acumulado. */
export function evaluateP2Days(dias: ReadonlyArray<{ gasto: number | string; vendas: number | string }>, p: ScaleParams) {
  let gAc = 0, vAc = 0;
  return dias.map((dia, i) => {
    gAc += n(dia.gasto); vAc += n(dia.vendas);
    const cpaAc = cpaOf(gAc, vAc);
    const zona = cpaZone(cpaAc, p);
    let leitura: Verdict<P2Reading>;
    if (i < 2) leitura = { veredito: "nao_julga", rotulo: "NÃO JULGA", acao: "Só julga no dia 3." };
    else if (cpaAc !== null && cpaAc <= p.cpaAlvo) leitura = { veredito: "aprovado", rotulo: "APROVADO", acao: "Vai para o P3." };
    else if (cpaAc !== null && cpaAc <= p.cpaAlvo * 1.5) leitura = { veredito: "estende", rotulo: "ESTENDE +3 DIAS", acao: "Roda mais 3 dias sem mexer." };
    else leitura = { veredito: "reprovado", rotulo: "REPROVADO", acao: "Volta para o P1 com texto novo." };
    return { dia: i + 1, gasto_acumulado: round2(gAc), vendas_acumuladas: vAc, cpa_acumulado: cpaAc === null ? null : round2(cpaAc), zona, ...leitura };
  });
}

/** Checkpoint do dia 2: sinal antecipado pelo custo por IC e por pageview. Não decide nada. */
export function p2Checkpoint(input: { gasto2d: number | string; ic: number | string; pageviews: number | string }, p: ScaleParams) {
  const g = n(input.gasto2d);
  const d = deriveParams(p);
  const read = (total: number, alvo: number, be: number) => {
    const custo = total > 0 ? round2(g / total) : null;
    const leitura = custo === null ? null : custo <= alvo ? "no ritmo do CPA alvo" : custo <= be ? "entre alvo e breakeven" : "acima do breakeven";
    return { total, custo, alvo: round2(alvo), breakeven: round2(be), leitura };
  };
  return {
    ic: read(n(input.ic), d.teto_custo_ic_qualificado, d.custo_ic_breakeven),
    pageview: read(n(input.pageviews), d.teto_custo_ic_qualificado / 3, d.custo_ic_breakeven / 3),
    observacao: "Sinal antecipado: a decisão é só no dia 3.",
  };
}

export type AdsetVerdict = "duplica" | "mantem" | "pausa";

/** Cada conjunto no dia 3. Pausar o conjunto não mata o concept. */
export function evaluateAdset(input: { gasto: number | string; vendas: number | string }, p: ScaleParams): Verdict<AdsetVerdict> & { cpa: number | null; zona: Zone } {
  const g = n(input.gasto), v = n(input.vendas);
  const cpa = cpaOf(g, v);
  const zona = cpaZone(cpa, p);
  const base = { cpa: cpa === null ? null : round2(cpa), zona };
  if (v === 0 && g > 0) return { ...base, veredito: "pausa", rotulo: "MATA", acao: "Pausa o conjunto. Não mata o concept." };
  if (zona === "escala" || zona === "lucrativa") return { ...base, veredito: "duplica", rotulo: "DUPLICA", acao: "Duplica na mesma campanha, mesma verba." };
  if (zona === "magra") return { ...base, veredito: "mantem", rotulo: "MANTÉM", acao: "Deixa rodando. Não duplica." };
  return { ...base, veredito: "pausa", rotulo: "MATA", acao: "Pausa o conjunto." };
}

// ── P3: escala ───────────────────────────────────────────────────────────────

/** Rotina de 10 segundos: qual freio está apertado hoje. Nunca mexe em verba e lance no mesmo dia. */
export function dailyBrake(input: { verba: number | string; gastoOntem: number | string }) {
  const verba = n(input.verba), ontem = n(input.gastoOntem);
  if (verba <= 0) return null;
  const pct = ontem / verba;
  return pct >= 0.95
    ? { pct_verba_gasta: round2(pct * 100), freio: "verba" as const, acao: "Sobe a verba ~20% (1 mexida hoje). Não mexe no lance." }
    : { pct_verba_gasta: round2(pct * 100), freio: "lance" as const, acao: "Sobe o lance ~17% e espera 48 h. Não mexe na verba." };
}

/** Escada do lance: sobe ~17% e espera 48 h; para quando o gasto não cresce. */
export function bidStep(input: { lance: number | string; cresceu?: boolean | null }) {
  const lance = n(input.lance);
  if (input.cresceu === true) return { proximo_lance: round2(lance * 1.175), acao: `Sobe para ${round2(lance * 1.175)} e espera 48 h.` };
  if (input.cresceu === false) return { proximo_lance: null, acao: "PARA. Volta para o lance anterior: achou o teto." };
  return { proximo_lance: null, acao: "Aguardando 48 h de leitura." };
}

export type ActiveAngleStatus = "cemiterio" | "revisa" | "sem_gasto" | "rodando";

/** Ângulo ativo no P3 (1 conjunto por ângulo), pelos últimos 7 dias. */
export function evaluateActiveAngle(input: { gasto7: number | string; vendas7: number | string; diasSemGastar: number | string }, p: ScaleParams): Verdict<ActiveAngleStatus> & { cpa7: number | null } {
  const g = n(input.gasto7), v = n(input.vendas7), ds = n(input.diasSemGastar);
  const cpa = cpaOf(g, v);
  const cpa7 = cpa === null ? null : round2(cpa);
  if (ds >= 7) return { cpa7, veredito: "cemiterio", rotulo: "→ CEMITÉRIO", acao: "Escalou e secou: move para o P4." };
  if (cpaZone(cpa, p) === "prejuizo") return { cpa7, veredito: "revisa", rotulo: "REVISA", acao: "CPA acima do payout." };
  if (g === 0) return { cpa7, veredito: "sem_gasto", rotulo: "SEM GASTO", acao: "Sem gasto nos últimos 7 dias." };
  return { cpa7, veredito: "rodando", rotulo: "RODANDO", acao: "Deixa rodar." };
}

// ── P4: cemitério ────────────────────────────────────────────────────────────

export const GRAVEYARD_SLOTS = 10;
export type GraveyardStatus = "dormindo" | "volta_p3" | "catando" | "gastou_sem_venda";

/** Ângulo no cemitério (cost cap): sai quem gastou 3 dias seguidos dentro do CPA. */
export function evaluateGraveyardAngle(input: { gasto7: number | string; vendas7: number | string; diasSeguidosNoCpa: number | string }): Verdict<GraveyardStatus> & { cpa7: number | null } {
  const g = n(input.gasto7), v = n(input.vendas7), dc = n(input.diasSeguidosNoCpa);
  const cpa = cpaOf(g, v);
  const cpa7 = cpa === null ? null : round2(cpa);
  if (g === 0) return { cpa7, veredito: "dormindo", rotulo: "DORMINDO", acao: "Normal: não faz nada." };
  if (dc >= 3) return { cpa7, veredito: "volta_p3", rotulo: "VOLTA PARA O P3", acao: "Sai do cemitério: cria conjunto novo no P3." };
  if (v > 0) return { cpa7, veredito: "catando", rotulo: "CATANDO", acao: "Achando inventário barato: deixa." };
  return { cpa7, veredito: "gastou_sem_venda", rotulo: "GASTOU SEM VENDA", acao: "O cost cap segura: observa." };
}

// ── Entrada única (MCP evaluate_scale) ───────────────────────────────────────

type Args = Record<string, unknown>;
const list = (v: unknown): Args[] => (Array.isArray(v) ? v.filter((x): x is Args => !!x && typeof x === "object") : []);
const obj = (v: unknown): Args => (v && typeof v === "object" && !Array.isArray(v) ? (v as Args) : {});
const text = (v: unknown) => (typeof v === "string" ? v : "");
const flag = (v: unknown): boolean | null => (v === true || v === "SIM" || v === "sim" ? true : v === false || v === "NAO" || v === "nao" || v === "NÃO" ? false : null);

/** Avalia uma fase a partir de argumentos soltos (vindos de IA ou JSON). Sem payout/CPA alvo, só devolve as regras. */
export function evaluateScale(args: Args) {
  const fase = text(args.fase) || "regras";
  if (fase === "regras") return { fase: "regras" as const, regras: SCALE_LADDER_RULES };
  const params: ScaleParams = { payout: n(args.payout), cpaAlvo: n(args.cpa_alvo), icsPorVenda: n(args.ics_por_venda) || undefined };
  if (params.payout <= 0 || params.cpaAlvo <= 0) throw new Error("payout e cpa_alvo (maiores que zero) são obrigatórios para avaliar uma fase");
  const parametros = deriveParams(params);
  switch (fase) {
    case "parametros":
      return { fase: "parametros" as const, parametros };
    case "p1":
      return { fase: "p1" as const, parametros, ...evaluateP1Round(list(args.concepts).map((r) => ({ concept: text(r.concept), hipotese: text(r.hipotese), gasto: n(r.gasto), ic: n(r.ic), vendas: n(r.vendas) })), params) };
    case "p2": {
      const cp = obj(args.checkpoint);
      return {
        fase: "p2" as const, parametros,
        dias: evaluateP2Days(list(args.dias).map((d) => ({ gasto: n(d.gasto), vendas: n(d.vendas) })), params),
        checkpoint_dia2: Object.keys(cp).length ? p2Checkpoint({ gasto2d: n(cp.gasto2d), ic: n(cp.ic), pageviews: n(cp.pageviews) }, params) : null,
        conjuntos: list(args.conjuntos).map((c) => ({ nome: text(c.nome), ...evaluateAdset({ gasto: n(c.gasto), vendas: n(c.vendas) }, params) })),
      };
    }
    case "p3":
      return {
        fase: "p3" as const, parametros,
        rotina_do_dia: dailyBrake({ verba: n(args.verba), gastoOntem: n(args.gasto_ontem) }),
        escada_do_lance: list(args.lances).map((l) => ({ lance: n(l.lance), ...bidStep({ lance: n(l.lance), cresceu: flag(l.cresceu) }) })),
        angulos: list(args.angulos).map((a) => ({ nome: text(a.nome), ...evaluateActiveAngle({ gasto7: n(a.gasto7), vendas7: n(a.vendas7), diasSemGastar: n(a.diasSemGastar) }, params) })),
        regra: "Nunca mexe em verba e lance no mesmo dia.",
      };
    case "p4": {
      const angulos = list(args.angulos).map((a) => ({ nome: text(a.nome), ...evaluateGraveyardAngle({ gasto7: n(a.gasto7), vendas7: n(a.vendas7), diasSeguidosNoCpa: n(a.diasSeguidosNoCpa) }) }));
      return { fase: "p4" as const, parametros, angulos, vagas_livres: Math.max(0, GRAVEYARD_SLOTS - angulos.length), observacao: "Gasto zero na maioria das semanas é o esperado." };
    }
    default:
      throw new Error(`fase inválida: '${fase}'. Use regras, parametros, p1, p2, p3 ou p4.`);
  }
}

// ── Rodadas lançadas na etapa do mapa (imphq_scale_rounds) ──────────────────

export const SCALE_PLAYBOOK_ID = "esteira-escala-dtc";
export type ScalePhase = "parametros" | "p1" | "p2" | "p3" | "p4";
export const SCALE_PHASE_LABEL: Record<ScalePhase, string> = {
  parametros: "Parâmetros", p1: "P1 · Teste de concepts", p2: "P2 · Rodada de texto", p3: "P3 · Escala", p4: "P4 · Cemitério",
};
/** Ordem da etapa no playbook → fase em que se lançam números. */
const PHASE_BY_ORDEM: Record<number, ScalePhase> = { 3: "parametros", 4: "p1", 5: "p1", 6: "p1", 7: "p2", 8: "p3", 9: "p4" };

/** Fase da esteira de uma etapa, pela marca que o playbook grava nas notas ([agent_playbook:esteira-escala-dtc#N]). */
export function scaleStepPhase(notes: string | null | undefined): ScalePhase | null {
  const m = /\[agent_playbook:([\w-]+)#(\d+)\]/.exec(notes ?? "");
  return m && m[1] === SCALE_PLAYBOOK_ID ? PHASE_BY_ORDEM[Number(m[2])] ?? null : null;
}

/** Parâmetros guardados na rodada → entrada do motor. */
export function paramsFrom(v: unknown): ScaleParams {
  const o = obj(v);
  return { payout: n(o.payout), cpaAlvo: n(o.cpa_alvo), icsPorVenda: n(o.ics_por_venda) || undefined };
}

/** Veredito de uma rodada salva ou em edição (mesma entrada do MCP evaluate_scale). Sem payout/CPA alvo, null. */
export function evaluateRound(fase: ScalePhase, params: unknown, data: unknown) {
  const p = paramsFrom(params);
  if (p.payout <= 0 || p.cpaAlvo <= 0) return null;
  return evaluateScale({ ...obj(data), fase, payout: p.payout, cpa_alvo: p.cpaAlvo, ics_por_venda: p.icsPorVenda });
}

type RoundResult = NonNullable<ReturnType<typeof evaluateRound>>;
const count = (items: ReadonlyArray<{ veredito: string }>, v: string) => items.filter((i) => i.veredito === v).length;

/** Uma linha para o histórico, o MCP e o resumo semanal. */
export function roundSummary(_fase: ScalePhase, r: RoundResult | null): string {
  if (!r) return "Sem payout e CPA alvo: sem veredito.";
  switch (r.fase) {
    case "regras":
      return "";
    case "parametros":
      return `Breakeven ${r.parametros.breakeven}, teto por IC ${r.parametros.teto_custo_ic_qualificado}.`;
    case "p1":
      return `${r.linhas.length} concepts: ${r.qualificados} qualificados, ${r.mais_textos} mais textos, ${r.mortos} mortos; ${r.placar_hipoteses.length} hipóteses no placar.`;
    case "p2": {
      const last = r.dias.at(-1);
      return [last ? `Dia ${last.dia}: ${last.rotulo}${last.cpa_acumulado !== null ? ` (CPA ${last.cpa_acumulado})` : ""}` : null,
        r.conjuntos.length ? `conjuntos: ${count(r.conjuntos, "duplica")} duplica, ${count(r.conjuntos, "mantem")} mantém, ${count(r.conjuntos, "pausa")} pausa` : null,
      ].filter(Boolean).join("; ") || "Sem dias lançados.";
    }
    case "p3":
      return [r.rotina_do_dia ? `Freio: ${r.rotina_do_dia.freio}` : null,
        r.angulos.length ? `${r.angulos.length} ângulos (${count(r.angulos, "rodando")} rodando, ${count(r.angulos, "revisa")} revisa, ${count(r.angulos, "cemiterio")} para o cemitério)` : null,
      ].filter(Boolean).join("; ") || "Sem números lançados.";
    case "p4":
      return `${r.angulos.length} no cemitério (${count(r.angulos, "volta_p3")} voltam ao P3), ${r.vagas_livres} vagas.`;
  }
}

/**
 * Placar de hipóteses acumulado do projeto a partir das rodadas do P1 salvas (mais recente primeiro):
 * cada hipótese aparece uma vez, com o resultado mais recente.
 */
export function hypothesisBoard(rounds: ReadonlyArray<{ fase: string; rodada?: string | null; resultado?: unknown; updated_at?: string }>) {
  const seen = new Map<string, { hipotese: string; concept: string; resultado: string; rodada: string | null; em: string | null }>();
  for (const r of rounds) {
    if (r.fase !== "p1") continue;
    for (const h of list(obj(r.resultado).placar_hipoteses)) {
      const hipotese = text(h.hipotese).trim();
      const key = hipotese.toLowerCase();
      if (!hipotese || seen.has(key)) continue;
      seen.set(key, { hipotese, concept: text(h.concept), resultado: text(h.resultado), rodada: r.rodada ?? null, em: r.updated_at ?? null });
    }
  }
  return [...seen.values()];
}

/** Linha de imphq_ads_spend (sync de anúncios) usada para pré-preencher a etapa. */
export interface SpendRow { data_ref: string | null; conjunto_anuncios?: string | null; campanha?: string | null; valor?: number | null; checkouts_iniciados?: number | null; compras?: number | null }

/** Soma por conjunto (concept no P1, conjunto no P2), maior gasto primeiro. */
export function spendByAdset(rows: ReadonlyArray<SpendRow>) {
  const by = new Map<string, { nome: string; gasto: number; ic: number; vendas: number }>();
  for (const r of rows) {
    const nome = (r.conjunto_anuncios || r.campanha || "Sem conjunto").trim();
    const cur = by.get(nome) ?? { nome, gasto: 0, ic: 0, vendas: 0 };
    cur.gasto = round2(cur.gasto + n(r.valor)); cur.ic += n(r.checkouts_iniciados); cur.vendas += n(r.compras);
    by.set(nome, cur);
  }
  return [...by.values()].sort((a, b) => b.gasto - a.gasto);
}

/** Soma por dia (diário do P2, gasto de ontem no P3), do mais antigo ao mais novo. */
export function spendByDay(rows: ReadonlyArray<SpendRow>) {
  const by = new Map<string, { dia: string; gasto: number; ic: number; vendas: number }>();
  for (const r of rows) {
    const dia = (r.data_ref ?? "").slice(0, 10);
    if (!dia) continue;
    const cur = by.get(dia) ?? { dia, gasto: 0, ic: 0, vendas: 0 };
    cur.gasto = round2(cur.gasto + n(r.valor)); cur.ic += n(r.checkouts_iniciados); cur.vendas += n(r.compras);
    by.set(dia, cur);
  }
  return [...by.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

/** Texto curto da metodologia para o contexto da IA e para a resposta do MCP. */
export const SCALE_LADDER_RULES = [
  "P1 teste de concepts: ABO 1-5-3, ~40/conjunto/dia, 2 dias sem mexer. 1 conjunto = 1 concept (ângulo + avatar), 3 anúncios. Veredito no fim do dia 2 pelo custo por checkout iniciado (IC): venda ou custo/IC ≤ CPA alvo ÷ ICs por venda = QUALIFICADO; até 1,75× esse teto = MAIS TEXTOS; acima ou sem IC com gasto alto = MATA.",
  "P2 rodada de primary text: ABO 1-5-10, 5 conjuntos idênticos com o texto vencedor e até 10 adformats, 3 dias. Julga só no dia 3 pelo CPA acumulado: ≤ alvo APROVADO (vai ao P3); ≤ 1,5× alvo ESTENDE 3 dias; acima REPROVADO (volta ao P1 com texto novo). Por conjunto: ESCALA/LUCRATIVA duplica, MAGRA mantém, resto pausa (pausar conjunto não mata o concept).",
  "P3 escala: CBO perpétuo com bid cap, 1 conjunto por ângulo. Lance inicial = 60% do CPA alvo; teto econômico = 80% do payout. Rotina diária: gastou ≥ 95% da verba ontem → sobe verba ~20%; senão sobe lance ~17% e espera 48 h. Nunca verba e lance no mesmo dia. Lance que não fez o gasto crescer: volta ao anterior. Ângulo 7+ dias sem gastar vai para o P4.",
  "P4 cemitério: CBO 1-1-10 com cost cap = 70% do CPA alvo, verba fixa, até 10 ângulos. Gasto zero é o normal. Ângulo com 3 dias seguidos dentro do CPA volta ao P3.",
  "Zonas do CPA: ≤ alvo ESCALA; ≤ 80% do payout LUCRATIVA; ≤ payout MAGRA; acima PREJUÍZO.",
  "O que se leva para a semana seguinte é o placar de hipóteses, não o criativo vencedor.",
];

// Visão "Caminho" do mapa (Story MAP2.3): caminho principal até a venda, alternativas, onde travou e métrica × meta.
// TS puro, sem dependências além das regras do mapa: usado pelo canvas e testável no vitest.
import { orderSteps, UNNUMBERED_KINDS, type OrderEdge, type OrderNode } from "./map-order.ts";

export interface PathNode extends OrderNode {
  label?: string | null;
  path_role?: string | null;
  step_status?: string | null;
}

/** Onde o caminho principal termina, em ordem de preferência: a compra, senão o checkout. */
const GOAL_KINDS = ["compra", "checkout"];

export interface MapPath {
  /** Etapas do caminho principal, na ordem do fluxo. */
  principal: string[];
  /** Etapas que saem de uma etapa do principal (desvios, recuperação, downsell), agrupadas pela etapa de onde saem. */
  alternativas: Map<string, string[]>;
  /** Etapas que vêm depois do fim do principal (pós-venda, medição). */
  depois: string[];
  /** Etapas sem ligação com o principal. */
  fora: string[];
  /** Fim usado para o principal (null quando o mapa não tem compra nem checkout ligado). */
  objetivo: string | null;
}

function graph(nodes: ReadonlyArray<PathNode>, edges: ReadonlyArray<OrderEdge>) {
  const steps = nodes.filter((n) => !UNNUMBERED_KINDS.has(n.kind || ""));
  const ids = new Set(steps.map((n) => n.id));
  const next = new Map<string, Set<string>>(steps.map((n) => [n.id, new Set()]));
  const prev = new Map<string, Set<string>>(steps.map((n) => [n.id, new Set()]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    next.get(e.source)!.add(e.target);
    prev.get(e.target)!.add(e.source);
  }
  return { steps, next, prev };
}

/**
 * Caminho principal: a sequência mais longa de setas que termina na compra (ou no checkout).
 * Setas que voltam na ordem do fluxo (ciclos) não contam. O ajuste manual (`path_role`) inclui ou tira etapas.
 */
export function buildMapPath(nodes: ReadonlyArray<PathNode>, edges: ReadonlyArray<OrderEdge>): MapPath {
  const order = orderSteps(nodes, edges);
  const { steps, next, prev } = graph(nodes, edges);
  const byOrder = [...steps].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const num = (id: string) => order.get(id) ?? 0;

  // Maior sequência até cada etapa, só com setas que andam para a frente na ordem.
  const len = new Map<string, number>();
  const from = new Map<string, string | null>();
  for (const n of byOrder) {
    let best = 1;
    let bestFrom: string | null = null;
    for (const p of [...(prev.get(n.id) ?? [])].sort((a, b) => num(a) - num(b))) {
      if (num(p) >= num(n.id)) continue;
      const l = (len.get(p) ?? 1) + 1;
      if (l > best) { best = l; bestFrom = p; }
    }
    len.set(n.id, best);
    from.set(n.id, bestFrom);
  }

  let objetivo: string | null = null;
  for (const kind of GOAL_KINDS) {
    const candidates = byOrder.filter((n) => n.kind === kind && (len.get(n.id) ?? 1) > 1);
    if (candidates.length) {
      objetivo = candidates.sort((a, b) => (len.get(b.id) ?? 0) - (len.get(a.id) ?? 0) || num(a.id) - num(b.id))[0].id;
      break;
    }
  }

  const auto: string[] = [];
  for (let cur = objetivo; cur; cur = from.get(cur) ?? null) auto.unshift(cur);

  const role = new Map(steps.map((n) => [n.id, n.path_role ?? null]));
  const principalSet = new Set(auto.filter((id) => role.get(id) !== "alternativa"));
  for (const n of steps) if (n.path_role === "principal") principalSet.add(n.id);
  const principal = [...principalSet].sort((a, b) => num(a) - num(b));
  const index = new Map(principal.map((id, i) => [id, i]));

  // Depois do fim: tudo que se alcança a partir do objetivo sem passar pelo principal.
  const depoisSet = new Set<string>();
  const end = principal[principal.length - 1];
  if (end) {
    const stack = [...(next.get(end) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (principalSet.has(id) || depoisSet.has(id) || role.get(id) === "alternativa") continue;
      depoisSet.add(id);
      stack.push(...(next.get(id) ?? []));
    }
  }

  // Alternativa: sai da última etapa do principal entre seus antecessores.
  const alternativas = new Map<string, string[]>();
  const fora: string[] = [];
  for (const n of byOrder) {
    if (principalSet.has(n.id) || depoisSet.has(n.id)) continue;
    let origin: string | null = null;
    const seen = new Set<string>();
    const stack = [...(prev.get(n.id) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (principalSet.has(id)) {
        if (origin === null || (index.get(id) ?? -1) > (index.get(origin) ?? -1)) origin = id;
        continue;
      }
      stack.push(...(prev.get(id) ?? []));
    }
    if (origin) alternativas.set(origin, [...(alternativas.get(origin) ?? []), n.id]);
    else fora.push(n.id);
  }

  return { principal, alternativas, depois: byOrder.filter((n) => depoisSet.has(n.id)).map((n) => n.id), fora, objetivo };
}

export interface PathFocus { id: string; motivo: string }

/** Onde o caminho está parado: a primeira etapa do principal que ainda não foi feita. */
export function pathFocus(
  principal: ReadonlyArray<string>,
  nodes: ReadonlyArray<{ id: string; step_status?: string | null; due_date?: string | null; owner_member_id?: string | null }>,
  today: string,
): PathFocus | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const id of principal) {
    const n = byId.get(id);
    if (!n || n.step_status === "done") continue;
    const motivos: string[] = [];
    if (n.step_status === "ready_review") motivos.push("esperando revisão");
    else if (n.step_status === "in_progress") motivos.push("em andamento");
    else motivos.push("não começou");
    if (!n.owner_member_id) motivos.push("sem dono");
    if (n.due_date && n.due_date < today) motivos.push(`atrasada desde ${n.due_date.split("-").reverse().join("/")}`);
    return { id, motivo: motivos.join(" · ") };
  }
  return null;
}

// ── Métrica × meta ──────────────────────────────────────────────────────

export type MetricVerdict = "verde" | "amarelo" | "vermelho" | "sem_regua" | "sem_dado";
export interface MetricRule { tipo: "max" | "min" | "faixa"; a: number; b?: number }

export interface ScaleRefs { cpaAlvo?: number; payout?: number; icsPorVenda?: number }

const NUMBER = /(-?\d+(?:[.,]\d+)?)/;
const toNum = (s: string) => Number(s.replace(",", "."));

/** Lê a meta escrita ("acima de 80%", "até o CPA alvo", "5% a 15%") como régua numérica. Sem número claro, null. */
export function parseMetricRule(meta: string | null | undefined, refs: ScaleRefs = {}): MetricRule | null {
  if (!meta) return null;
  const t = meta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Meta ainda por definir ou proporção ("1 a cada 10 conversas") não vira régua.
  if (/\b(definir|ajustar|a cada)\b/.test(t)) return null;
  const ics = refs.icsPorVenda && refs.icsPorVenda > 0 ? refs.icsPorVenda : 8;
  // Metas relativas da esteira de escala.
  if (/payout\s*[÷/]\s*cpa alvo/.test(t)) return refs.payout && refs.cpaAlvo ? { tipo: "min", a: refs.payout / refs.cpaAlvo } : null;
  if (/cpa alvo\s*[÷/]\s*ics/.test(t)) return refs.cpaAlvo ? { tipo: "max", a: refs.cpaAlvo / ics } : null;
  if (/cpa alvo/.test(t)) return refs.cpaAlvo ? { tipo: "max", a: refs.cpaAlvo } : null;
  const range = t.match(/(-?\d+(?:[.,]\d+)?)\s*%?\s*(?:a|ate|-|–)\s*(-?\d+(?:[.,]\d+)?)/);
  if (range && !/^\s*ate\b/.test(t)) return { tipo: "faixa", a: toNum(range[1]), b: toNum(range[2]) };
  const n = t.match(NUMBER);
  if (!n) return null;
  if (/\b(ate|abaixo|maximo|no maximo|menor)\b|≤|<=/.test(t)) return { tipo: "max", a: toNum(n[1]) };
  return { tipo: "min", a: toNum(n[1]) };
}

/** Verde no alvo; amarelo até 20% fora; vermelho além disso. */
export function metricVerdict(real: number | null | undefined, rule: MetricRule | null): MetricVerdict {
  if (real === null || real === undefined || !Number.isFinite(real)) return "sem_dado";
  if (!rule) return "sem_regua";
  const near = (limit: number) => Math.abs(limit) * 0.2;
  if (rule.tipo === "max") return real <= rule.a ? "verde" : real <= rule.a + near(rule.a) ? "amarelo" : "vermelho";
  if (rule.tipo === "min") return real >= rule.a ? "verde" : real >= rule.a - near(rule.a) ? "amarelo" : "vermelho";
  const lo = Math.min(rule.a, rule.b ?? rule.a);
  const hi = Math.max(rule.a, rule.b ?? rule.a);
  if (real >= lo && real <= hi) return "verde";
  return real >= lo - near(lo) && real <= hi + near(hi) ? "amarelo" : "vermelho";
}

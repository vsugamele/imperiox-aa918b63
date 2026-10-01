// Ordem de leitura das etapas de um mapa: segue as setas (quem vem antes) e, no empate, a posição no canvas
// (faixa de cima antes, depois da esquerda para a direita). TS puro: usado pelo canvas e pelo project-mcp.

export interface OrderNode { id: string; kind?: string | null; position?: { x?: number; y?: number } | null }
export interface OrderEdge { source: string; target: string }

/** Cartões que só organizam o mapa (centro do projeto, área, imagem solta) não recebem número. */
export const UNNUMBERED_KINDS = new Set(["vertical", "area", "imagem"]);

/** Altura da faixa usada no desempate: cartões com y parecido contam como a mesma linha. */
const ROW_BAND = 220;

function rank(node: OrderNode): [number, number] {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  return [Math.floor(y / ROW_BAND), x];
}

function compare(a: OrderNode, b: OrderNode): number {
  const [ra, xa] = rank(a);
  const [rb, xb] = rank(b);
  return ra - rb || xa - xb || a.id.localeCompare(b.id);
}

/**
 * Numera as etapas (1, 2, 3…). Kahn com desempate por posição; em ciclo, entra a etapa
 * mais acima/à esquerda que ainda falta. Setas que tocam cartões sem número são ignoradas.
 */
export function orderSteps(nodes: ReadonlyArray<OrderNode>, edges: ReadonlyArray<OrderEdge>): Map<string, number> {
  const steps = nodes.filter((n) => !UNNUMBERED_KINDS.has(n.kind || ""));
  const byId = new Map(steps.map((n) => [n.id, n]));
  const indegree = new Map(steps.map((n) => [n.id, 0]));
  const next = new Map<string, string[]>(steps.map((n) => [n.id, []]));
  const seen = new Set<string>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
    const key = `${e.source}->${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  const result = new Map<string, number>();
  const remaining = new Set(steps.map((n) => n.id));
  const ready = steps.filter((n) => indegree.get(n.id) === 0);
  while (remaining.size) {
    if (!ready.length) {
      // Ciclo: destrava pela etapa mais acima/à esquerda que falta.
      ready.push([...remaining].map((id) => byId.get(id)!).sort(compare)[0]);
    }
    ready.sort(compare);
    const current = ready.shift()!;
    if (!remaining.has(current.id)) continue;
    remaining.delete(current.id);
    result.set(current.id, result.size + 1);
    for (const target of next.get(current.id) ?? []) {
      const left = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, left);
      if (left === 0 && remaining.has(target)) ready.push(byId.get(target)!);
    }
  }
  return result;
}

// Mapas de conhecimento (MAP3.1): resumos de livro e mapas mentais viram uma lista recolhível por seção.
// Puro: decide se o mapa é de conhecimento e monta a árvore a partir das ligações.

export interface OutlineNodeInput { id: string; label: string; kind: string; position?: { x: number; y: number } | null; description?: string | null; notes?: string | null; image_url?: string | null; url?: string | null }
export interface OutlineEdgeInput { source: string; target: string }

export interface OutlineItem {
  id: string;
  label: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  children: OutlineItem[];
  /** Total de itens abaixo (todos os níveis). */
  total: number;
}

/** Mapa de conhecimento: 20+ cartões e pelo menos 80% deles são documentos/anotações, não etapas de funil. */
export function isKnowledgeMap(nodes: ReadonlyArray<Pick<OutlineNodeInput, "kind">>): boolean {
  if (nodes.length < 20) return false;
  const docs = nodes.filter((n) => n.kind === "doc" || n.kind === "nota" || n.kind === "documento").length;
  return docs / nodes.length >= 0.8;
}

const byPosition = (a: OutlineNodeInput, b: OutlineNodeInput) => (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0);

/**
 * Árvore pela direção das ligações (origem = pai). Um cartão com mais de um pai fica sob o primeiro; ciclos são
 * cortados; cartões soltos viram raízes. Irmãos seguem a ordem visual (de cima para baixo, da esquerda para a direita).
 */
export function buildOutline(nodes: ReadonlyArray<OutlineNodeInput>, edges: ReadonlyArray<OutlineEdgeInput>): OutlineItem[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parent = new Map<string, string>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target || parent.has(e.target)) continue;
    // Evita ciclo: o novo pai não pode descender do filho.
    let p: string | undefined = e.source;
    let cycle = false;
    for (let guard = 0; p && guard < nodes.length; guard++) { if (p === e.target) { cycle = true; break; } p = parent.get(p); }
    if (!cycle) parent.set(e.target, e.source);
  }
  const children = new Map<string, OutlineNodeInput[]>();
  for (const [child, par] of parent) children.set(par, [...(children.get(par) ?? []), byId.get(child) as OutlineNodeInput]);
  const build = (n: OutlineNodeInput): OutlineItem => {
    const kids = (children.get(n.id) ?? []).sort(byPosition).map(build);
    return {
      id: n.id, label: n.label, description: (n.description || n.notes || null), image_url: n.image_url ?? null, url: n.url ?? null,
      children: kids, total: kids.reduce((s, k) => s + 1 + k.total, 0),
    };
  };
  return nodes.filter((n) => !parent.has(n.id)).sort(byPosition).map(build);
}

/** Filtra a árvore mantendo os ancestrais de quem bate com a busca. */
export function filterOutline(items: ReadonlyArray<OutlineItem>, query: string): OutlineItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  const walk = (it: OutlineItem): OutlineItem | null => {
    const kids = it.children.map(walk).filter((k): k is OutlineItem => !!k);
    const hit = `${it.label} ${it.description ?? ""}`.toLowerCase().includes(q);
    return hit || kids.length ? { ...it, children: hit ? it.children : kids } : null;
  };
  return items.map(walk).filter((k): k is OutlineItem => !!k);
}

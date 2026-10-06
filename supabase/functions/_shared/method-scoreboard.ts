// Placar por método, ângulo da biblioteca ou categoria (CPY1.1): soma o que cada anúncio testado gastou e vendeu
// (leitura ao vivo do teste) e agrupa pela etiqueta da variante. TS puro, usado pelo painel e pelo MCP.

export type ScoreBy = "metodo" | "angulo" | "categoria";

export interface ScoreInput {
  metodo: string | null;
  copy_lib_id: string | null;
  gasto: number;
  ic: number;
  vendas: number;
  receita_liquida: number;
}

export interface ScoreLine {
  chave: string;
  rotulo: string;
  anuncios: number;
  com_venda: number;
  taxa_com_venda: number;
  gasto: number;
  ic: number;
  vendas: number;
  cpa: number | null;
  receita_liquida: number;
  saldo: number;
}

export interface LibraryRef { id: string; nome: string; categoria: string; numero?: number }

export const SEM_ETIQUETA = "sem_etiqueta";

export const CATEGORIA_LABEL: Record<string, string> = {
  problema: "Problema",
  solucao: "Solução",
  produto: "Produto",
  oferta: "Oferta",
  generico: "Genérico",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "derick:native-ads" → "derick:native-ads"; vazio vira null. Minúsculas, sem espaços nas pontas. */
export function normalizeMetodo(metodo: string | null | undefined): string | null {
  const m = String(metodo ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return m || null;
}

function keyOf(row: ScoreInput, by: ScoreBy, lib: Map<string, LibraryRef>): string {
  if (by === "metodo") return normalizeMetodo(row.metodo) ?? SEM_ETIQUETA;
  if (!row.copy_lib_id) return SEM_ETIQUETA;
  if (by === "angulo") return row.copy_lib_id;
  return lib.get(row.copy_lib_id)?.categoria ?? SEM_ETIQUETA;
}

function labelOf(key: string, by: ScoreBy, lib: Map<string, LibraryRef>): string {
  if (key === SEM_ETIQUETA) return "Sem etiqueta";
  if (by === "angulo") {
    const item = lib.get(key);
    return item ? `${item.numero ?? ""} · ${item.nome}`.replace(/^ · /, "") : key;
  }
  if (by === "categoria") return CATEGORIA_LABEL[key] ?? key;
  return key;
}

/**
 * Agrupa os anúncios testados. Ordem: mais vendas, depois menor CPA, depois menos gasto; "sem etiqueta" sempre por último
 * (é o lembrete de que falta etiquetar, não uma categoria que compete).
 */
export function methodScoreboard(rows: ReadonlyArray<ScoreInput>, by: ScoreBy, library: ReadonlyArray<LibraryRef> = []): ScoreLine[] {
  const lib = new Map(library.map((l) => [l.id, l]));
  const groups = new Map<string, ScoreInput[]>();
  for (const r of rows) {
    const k = keyOf(r, by, lib);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const lines: ScoreLine[] = [...groups.entries()].map(([chave, rs]) => {
    const gasto = round2(rs.reduce((s, r) => s + r.gasto, 0));
    const vendas = rs.reduce((s, r) => s + r.vendas, 0);
    const receita = round2(rs.reduce((s, r) => s + r.receita_liquida, 0));
    const comVenda = rs.filter((r) => r.vendas > 0).length;
    return {
      chave,
      rotulo: labelOf(chave, by, lib),
      anuncios: rs.length,
      com_venda: comVenda,
      taxa_com_venda: rs.length ? round2(comVenda / rs.length) : 0,
      gasto,
      ic: rs.reduce((s, r) => s + r.ic, 0),
      vendas,
      cpa: vendas ? round2(gasto / vendas) : null,
      receita_liquida: receita,
      saldo: round2(receita - gasto),
    };
  });
  return lines.sort((a, b) =>
    Number(a.chave === SEM_ETIQUETA) - Number(b.chave === SEM_ETIQUETA)
    || b.vendas - a.vendas
    || (a.cpa ?? Infinity) - (b.cpa ?? Infinity)
    || a.gasto - b.gasto);
}

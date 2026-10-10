// Placar por método, ângulo da biblioteca ou categoria (CPY1.1) e pelas réguas do Método H&W (MHW1.1: porta, carga,
// ponto da rota, pouso): soma o que cada anúncio testado gastou e vendeu (leitura ao vivo do teste) e agrupa pela
// etiqueta da variante. TS puro, usado pelo painel e pelo MCP.
import { CARGAS, PONTOS_ROTA, PORTAS, POUSOS } from "./hw-taxonomy.ts";
import { FORMATO_LABEL } from "./batch-strategist.ts";

export type ScoreBy = "metodo" | "angulo" | "categoria" | "porta" | "carga" | "ponto_rota" | "pouso" | "formato" | "avatar";

export interface ScoreInput {
  metodo: string | null;
  copy_lib_id: string | null;
  porta?: string | null;
  carga?: string | null;
  ponto_rota?: number | null;
  pouso?: string | null;
  formato?: string | null;
  avatar_id?: string | null;
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
  if (by === "porta" || by === "carga" || by === "pouso" || by === "formato") return row[by] || SEM_ETIQUETA;
  if (by === "avatar") return row.avatar_id || SEM_ETIQUETA;
  if (by === "ponto_rota") return row.ponto_rota ? String(row.ponto_rota) : SEM_ETIQUETA;
  if (!row.copy_lib_id) return SEM_ETIQUETA;
  if (by === "angulo") return row.copy_lib_id;
  return lib.get(row.copy_lib_id)?.categoria ?? SEM_ETIQUETA;
}

function labelOf(key: string, by: ScoreBy, lib: Map<string, LibraryRef>, nomes?: ReadonlyMap<string, string>): string {
  if (key === SEM_ETIQUETA) return "Sem etiqueta";
  if (by === "avatar") return nomes?.get(key) ?? key;
  if (by === "angulo") {
    const item = lib.get(key);
    return item ? `${item.numero ?? ""} · ${item.nome}`.replace(/^ · /, "") : key;
  }
  if (by === "categoria") return CATEGORIA_LABEL[key] ?? key;
  if (by === "porta") return PORTAS[key as keyof typeof PORTAS] ?? key;
  if (by === "carga") return CARGAS[key as keyof typeof CARGAS] ?? key;
  if (by === "pouso") return POUSOS[key as keyof typeof POUSOS] ?? key;
  if (by === "formato") return FORMATO_LABEL[key] ?? key;
  if (by === "ponto_rota") return `${key} · ${PONTOS_ROTA[Number(key) as keyof typeof PONTOS_ROTA] ?? ""}`.replace(/ · $/, "");
  return key;
}

/**
 * Agrupa os anúncios testados. Ordem: mais vendas, depois menor CPA, depois menos gasto; "sem etiqueta" sempre por último
 * (é o lembrete de que falta etiquetar, não uma categoria que compete).
 */
export function methodScoreboard(rows: ReadonlyArray<ScoreInput>, by: ScoreBy, library: ReadonlyArray<LibraryRef> = [], avatarNomes?: ReadonlyMap<string, string>): ScoreLine[] {
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
      rotulo: labelOf(chave, by, lib, avatarNomes),
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

export interface MarketRef { copy_lib_id: string | null; copy_lib_status: string | null; copy_lib_camada?: string | null }

/**
 * O que o mercado está rodando: ângulos das referências classificadas. Só contam as decisões firmes ou revisadas por
 * alguém do time; as dúvidas ficam de fora até serem revisadas.
 */
export function marketSummary(refs: ReadonlyArray<MarketRef>, library: ReadonlyArray<LibraryRef> = []) {
  const lib = new Map(library.map((l) => [l.id, l]));
  const valid = refs.filter((r) => r.copy_lib_id && (r.copy_lib_status === "firme" || r.copy_lib_status === "revisado"));
  const porAngulo = new Map<string, number>();
  const porCamada = new Map<string, number>();
  for (const r of valid) {
    const id = r.copy_lib_id as string;
    porAngulo.set(id, (porAngulo.get(id) ?? 0) + 1);
    const cam = lib.get(id)?.categoria ?? "generico";
    porCamada.set(cam, (porCamada.get(cam) ?? 0) + 1);
  }
  return {
    classificadas: valid.length,
    duvidas: refs.filter((r) => r.copy_lib_status === "duvida").length,
    angulos: [...porAngulo.entries()].map(([id, n]) => ({ id, n, rotulo: labelOf(id, "angulo", lib) })).sort((a, b) => b.n - a.n),
    camadas: [...porCamada.entries()].map(([id, n]) => ({ id, n, rotulo: CATEGORIA_LABEL[id] ?? id })).sort((a, b) => b.n - a.n),
  };
}

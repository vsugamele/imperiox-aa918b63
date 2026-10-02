// Aviso de venda nova (UX1.4): o que é venda "nova" para mostrar na tela, sem repetir.
// Consulta periódica (não realtime): imphq_vendas está sem RLS, então não entra na publicação de realtime.

export interface WatchedSale { id: string; project_id: string | null; valor: number | null; produto_nome: string | null; data: unknown; created_at: string }

const FRESH_MS = 2 * 3_600_000;

/**
 * Vendas aprovadas ainda não avisadas e recentes (últimas 2 h). Na primeira leitura (`seeded=false`)
 * só marca como vistas: abrir o sistema não dispara avisos antigos.
 */
export function newSales(rows: ReadonlyArray<WatchedSale>, seen: Set<string>, seeded: boolean, now: number = Date.now()): WatchedSale[] {
  const fresh: WatchedSale[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (seeded && now - Date.parse(r.created_at) <= FRESH_MS) fresh.push(r);
  }
  return fresh;
}

export function saleCurrency(data: unknown): string {
  if (data && typeof data === "object" && "moeda" in data) {
    const m = (data as { moeda?: unknown }).moeda;
    if (typeof m === "string" && m.trim()) return m.trim().toUpperCase();
  }
  return "BRL";
}

/** Adapted from supabasePaginate: reports require complete data or an explicit error. */
export async function paginatedQuery<T>(
  source: string,
  buildQuery: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  pageSize = 1000,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Tamanho de página inválido");
  const rows: T[] = [];
  for (;;) {
    try {
      const { data, error } = await buildQuery(rows.length, rows.length + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Resposta indisponível");
      if (data.length === 0) return rows;
      // Advance by the actual count, including when the server caps a page below pageSize.
      rows.push(...data);
    } catch (error) {
      throw new Error(`${source}: ${error instanceof Error ? error.message : "Falha ao carregar"}`);
    }
  }
}

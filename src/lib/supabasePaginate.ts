/**
 * fetchAll — paginated Supabase fetch.
 * Iterates `.range(from, to)` in chunks until results are exhausted or hardCap is hit.
 *
 * Usage:
 *   const rows = await fetchAll((from, to) =>
 *     supabase.from("imphq_vendas").select("*").eq("project_id", id).range(from, to)
 *   );
 */
export async function fetchAll<T = any>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000,
  hardCap = 50000,
  onProgress?: (loaded: number) => void,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (out.length < hardCap) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) {
      console.error("[fetchAll] error", error);
      break;
    }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    onProgress?.(out.length);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out.slice(0, hardCap);
}

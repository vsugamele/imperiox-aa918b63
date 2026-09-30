// Structural contract shared by the SDK versions already used by Edge Functions.
// No runtime dependency or SDK upgrade is required.
interface DatabaseResult { data: unknown; error: unknown }
interface DatabaseQuery extends PromiseLike<DatabaseResult> {
  eq(column: string, value: unknown): DatabaseQuery;
  maybeSingle(): PromiseLike<DatabaseResult>;
}
export interface DatabaseTable {
  select(columns: string): DatabaseQuery;
  update(values: Record<string, unknown>): DatabaseQuery;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string; ignoreDuplicates?: boolean }): DatabaseQuery;
}
export interface DatabasePort { from(table: string): unknown }
export function databaseTable(client: DatabasePort, name: string): DatabaseTable {
  const value = client.from(name);
  if (!value || typeof value !== "object" || !("select" in value) || !("update" in value) || !("upsert" in value)) {
    throw new Error("Invalid database query builder");
  }
  return value as DatabaseTable;
}

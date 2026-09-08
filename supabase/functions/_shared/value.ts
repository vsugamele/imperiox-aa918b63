/** Narrow external payloads before reading fields. */
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : text(record(error).message);
}

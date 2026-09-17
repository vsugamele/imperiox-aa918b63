import type { Json } from "@/integrations/supabase/types";

export function jsonFields(value: Json | undefined): { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function jsonText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
export function jsonNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function objectFields(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

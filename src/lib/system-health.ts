import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// Diagnóstico "o que está no ar" — vem da RPC imphq_system_health (só leitura).
export const healthStatusSchema = z.enum(["ok", "warn", "fail", "unknown"]);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

const checkSchema = z.object({
  key: z.string(),
  area: z.string().default("Outros"),
  label: z.string(),
  status: healthStatusSchema.catch("unknown"),
  last_at: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  hint: z.string().nullable().optional(),
});
export type HealthCheck = z.infer<typeof checkSchema>;

const reportSchema = z.object({
  generated_at: z.string(),
  checks: z.array(checkSchema),
});
export type HealthReport = z.infer<typeof reportSchema>;

export const STATUS_ORDER: Record<HealthStatus, number> = { fail: 0, warn: 1, unknown: 2, ok: 3 };

export function parseHealthReport(raw: unknown): HealthReport {
  return reportSchema.parse(raw);
}

export function summarize(checks: HealthCheck[]) {
  const count = { ok: 0, warn: 0, fail: 0, unknown: 0 } as Record<HealthStatus, number>;
  for (const c of checks) count[c.status] += 1;
  return count;
}

export async function fetchSystemHealth(): Promise<HealthReport> {
  const { data, error } = await supabase.rpc("imphq_system_health");
  if (error) throw error;
  return parseHealthReport(data);
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    retry: 1,
  });
}

/** "há 3 h", "há 2 dias" — sem dependência extra. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "sem registro";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "sem registro";
  const min = Math.round((now - t) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

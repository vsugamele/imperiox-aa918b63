import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { metricValues, pageSnapshots, type ProjectMetricSnapshot } from "@/lib/map-stage-metrics";

export function useMapPathMetrics(projectIds: string[], enabled: boolean) {
  const ids = [...new Set(projectIds)].sort();
  return useQuery({
    queryKey: ["map-path-metrics", ids.join(","), "7d"],
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Record<string, ProjectMetricSnapshot>> => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const entries = await Promise.all(ids.map(async (id): Promise<[string, ProjectMetricSnapshot]> => {
        try {
          const [metrics, pages, rounds] = await Promise.all([
            supabase.rpc("imphq_project_metrics", { p_project_id: id, p_since: since }),
            supabase.rpc("imphq_page_metrics", { p_project_id: id, p_since: since }),
            supabase.from("imphq_scale_rounds").select("params").eq("project_id", id).order("updated_at", { ascending: false }).limit(1),
          ]);
          for (const result of [metrics, pages, rounds]) if (result.error) throw result.error;
          const params = rounds.data?.[0]?.params;
          const p = params && typeof params === "object" && !Array.isArray(params) ? params as Record<string, unknown> : null;
          const refs = p ? { cpaAlvo: Number(p.cpaAlvo) || undefined, payout: Number(p.payout) || undefined, icsPorVenda: Number(p.icsPorVenda) || undefined } : null;
          return [id, { values: metricValues(metrics.data), pages: pageSnapshots(pages.data), refs, updatedAt: new Date().toISOString() }];
        } catch {
          return [id, { values: {}, pages: [], refs: null, updatedAt: new Date().toISOString(), error: "Métricas indisponíveis" }];
        }
      }));
      return Object.fromEntries(entries);
    },
  });
}

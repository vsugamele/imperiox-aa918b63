import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NodeStats { revenue30d: number; leadsAbertos: number; }

export function useCompanyMapLiveStats(projectIds: string[]) {
  return useQuery({
    queryKey: ["company-map-stats", projectIds.sort().join(",")],
    enabled: projectIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [vendas, leads] = await Promise.all([
        supabase.from("imphq_vendas").select("project_id, valor").in("project_id", projectIds).gte("created_at", since),
        supabase.from("imphq_leads").select("project_id").in("project_id", projectIds).neq("status", "ganho"),
      ]);
      const map: Record<string, NodeStats> = {};
      projectIds.forEach(id => (map[id] = { revenue30d: 0, leadsAbertos: 0 }));
      (vendas.data || []).forEach((v: any) => {
        if (map[v.project_id]) map[v.project_id].revenue30d += Number(v.valor || 0);
      });
      (leads.data || []).forEach((l: any) => {
        if (map[l.project_id]) map[l.project_id].leadsAbertos += 1;
      });
      return map;
    },
  });
}

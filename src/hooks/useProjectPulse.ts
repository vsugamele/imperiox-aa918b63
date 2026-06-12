import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectPulse {
  revenueToday: number;
  revenueMonth: number;
  revenueYesterday: number;
  adsToday: number;
  roasToday: number | null;
  hotLeads: number;
  leadsToday: number;
  loading: boolean;
}

const initial: ProjectPulse = {
  revenueToday: 0,
  revenueMonth: 0,
  revenueYesterday: 0,
  adsToday: 0,
  roasToday: null,
  hotLeads: 0,
  leadsToday: 0,
  loading: true,
};

export function useProjectPulse(projectId: string | undefined, refreshMs = 60_000) {
  const { data, refetch } = useQuery({
    queryKey: ["project-pulse", projectId],
    enabled: !!projectId,
    staleTime: refreshMs,
    refetchInterval: refreshMs || false,
    queryFn: async (): Promise<ProjectPulse> => {
      const now = new Date();
      const brOffset = -3 * 60;
      const brNow = new Date(now.getTime() + (brOffset + now.getTimezoneOffset()) * 60000);
      const todayStr = brNow.toISOString().split("T")[0];
      const dayStart = todayStr + "T03:00:00.000Z";
      const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString();
      const yStart = new Date(new Date(dayStart).getTime() - 86400000).toISOString();
      const monthStart = `${todayStr.slice(0, 7)}-01T03:00:00.000Z`;
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

      const sb: any = supabase;
      const promises: PromiseLike<any>[] = [
        sb.from("imphq_vendas").select("valor, status").eq("project_id", projectId).eq("status", "aprovado").gte("created_at", dayStart).lt("created_at", dayEnd),
        sb.from("imphq_vendas").select("valor, status").eq("project_id", projectId).eq("status", "aprovado").gte("created_at", monthStart),
        sb.from("imphq_vendas").select("valor, status").eq("project_id", projectId).eq("status", "aprovado").gte("created_at", yStart).lt("created_at", dayStart),
        sb.from("imphq_ads_spend").select("valor").eq("project_id", projectId).eq("data_ref", todayStr),
        sb.from("imphq_vendas").select("id, status, last_intent_at").eq("project_id", projectId).neq("status", "aprovado").gte("last_intent_at", twoHoursAgo),
        sb.from("imphq_leads").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("criado_em", dayStart),
      ];

      const [todayRes, monthRes, ystRes, adsRes, hotRes, leadsRes] = await Promise.all(promises);

      const sumValor = (rows: any[]) => (rows || []).reduce((acc, r) => acc + Number(r.valor || 0), 0);
      const revenueToday = sumValor(todayRes.data);
      const revenueMonth = sumValor(monthRes.data);
      const revenueYesterday = sumValor(ystRes.data);
      const adsToday = sumValor(adsRes.data);
      const roasToday = adsToday > 0 ? revenueToday / adsToday : null;

      return {
        revenueToday,
        revenueMonth,
        revenueYesterday,
        adsToday,
        roasToday,
        hotLeads: (hotRes.data || []).length,
        leadsToday: (leadsRes as any).count || 0,
        loading: false,
      };
    },
  });

  return { pulse: data ?? initial, reload: () => refetch() };
}

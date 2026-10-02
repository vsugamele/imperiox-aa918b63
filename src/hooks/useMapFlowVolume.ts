import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sessionsByUrl, type ProjectVolume } from "@shared/flow-volume";

export interface MapFlowData {
  sessions: Map<string, number>;
  byProject: Record<string, ProjectVolume>;
}

/** Volume real dos últimos 7 dias dos projetos do mapa: sessões por URL, conversas novas, vendas aprovadas e leads. */
export function useMapFlowVolume(projectIds: string[]) {
  const ids = [...projectIds].sort();
  return useQuery({
    queryKey: ["map-flow-volume", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MapFlowData> => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [eventsRes, convRes, salesRes, leadsRes] = await Promise.all([
        supabase.from("imphq_funnel_events").select("page_url, session_id").in("project_id", ids).gte("created_at", since).neq("step", "heartbeat").limit(5000),
        supabase.from("imphq_wa_conversations").select("project_id, jid_suffix").in("project_id", ids).gte("created_at", since).limit(5000),
        supabase.from("imphq_vendas").select("project_id").in("project_id", ids).eq("status", "aprovado").gte("created_at", since).limit(5000),
        supabase.from("imphq_leads").select("project_id").in("project_id", ids).gte("criado_em", since).limit(5000),
      ]);
      for (const res of [eventsRes, convRes, salesRes, leadsRes]) if (res.error) throw res.error;
      const byProject: Record<string, ProjectVolume> = Object.fromEntries(ids.map((id) => [id, { conversas: 0, vendas: 0, leads: 0 }]));
      for (const c of convRes.data ?? []) if (c.project_id && c.jid_suffix !== "g.us" && byProject[c.project_id]) byProject[c.project_id].conversas++;
      for (const s of salesRes.data ?? []) if (s.project_id && byProject[s.project_id]) byProject[s.project_id].vendas++;
      for (const l of leadsRes.data ?? []) if (l.project_id && byProject[l.project_id]) byProject[l.project_id].leads++;
      return { sessions: sessionsByUrl(eventsRes.data ?? []), byProject };
    },
  });
}

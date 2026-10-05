import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { JournalRow } from "@shared/journal";

/** Diário dos últimos 7 dias, por projeto (mais recente primeiro). */
export function useProjectJournal(projectIds: string[]) {
  const ids = [...projectIds].sort();
  return useQuery({
    queryKey: ["project-journal", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, JournalRow[]>> => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await supabase.from("imphq_activity_log")
        .select("project_id, created_at, action, actor, entity_name, details")
        .in("project_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const by: Record<string, JournalRow[]> = {};
      for (const row of data ?? []) if (row.project_id) (by[row.project_id] ??= []).push({ ...row, created_at: row.created_at ?? "" });
      return by;
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProjectListItem = {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
  is_archived: boolean | null;
};

/**
 * Lista compartilhada de projetos.
 *
 * Cacheada em TanStack Query (queryKey `["project-list", includeArchived]`)
 * com staleTime 5min — evita N fetches duplicados quando várias páginas/widgets
 * pedem a mesma lista no mesmo período.
 *
 * Use `useProjectList()` para lista navegável (sem arquivados).
 * Use `useProjectList({ includeArchived: true })` para telas administrativas.
 */
export function useProjectList(opts?: { includeArchived?: boolean }) {
  const includeArchived = opts?.includeArchived ?? false;

  return useQuery({
    queryKey: ["project-list", includeArchived],
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async (): Promise<ProjectListItem[]> => {
      let q = supabase
        .from("imphq_projects")
        .select("id, name, icon, category, is_archived" as any)
        .order("name", { ascending: true });

      if (!includeArchived) {
        q = q.or("is_archived.eq.false,is_archived.is.null");
      }

      const { data, error } = await q;
      if (error) {
        console.error("[useProjectList] error", error);
        return [];
      }
      return (data || []) as unknown as ProjectListItem[];
    },
  });
}

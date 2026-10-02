import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { writeAgentNotes, type StepStatus } from "@shared/map-steps";
import { buildTodayBoard, type ProjectBoard } from "@/lib/today-board";

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function loadTodayBoard(): Promise<ProjectBoard[]> {
  const since = startOfToday();
  const [projectsRes, nodesRes, salesRes, leadsRes, archivedRes] = await Promise.all([
    supabase.from("imphq_projects").select("id, name").or("is_archived.eq.false,is_archived.is.null").order("name"),
    supabase.from("imphq_company_map_nodes")
      .select("id, map_id, label, kind, description, notes, checklist, position, executor_type, linked_skill_id, linked_project_id, stage_role, step_status, owner_member_id, due_date"),
    supabase.from("imphq_vendas").select("project_id, valor, data").eq("status", "aprovado").gte("data_venda", since),
    supabase.from("imphq_leads").select("project_id").gte("created_at", since),
    supabase.from("imphq_company_maps").select("id").not("archived_at", "is", null),
  ]);
  for (const res of [projectsRes, nodesRes, salesRes, leadsRes, archivedRes]) {
    if (res.error) throw res.error;
  }
  const archived = new Set((archivedRes.data ?? []).map((m) => m.id));
  return buildTodayBoard({
    projects: projectsRes.data ?? [],
    nodes: (nodesRes.data ?? []).filter((n) => !archived.has(n.map_id)),
    salesToday: salesRes.data ?? [],
    leadsToday: leadsRes.data ?? [],
  });
}

/** Quadro do dia: etapas de cada projeto (pela regra única de @shared/map-steps), vendas e leads de hoje. */
export function useTodayBoard() {
  return useQuery({
    queryKey: ["today-board"],
    queryFn: loadTodayBoard,
    staleTime: 60_000,
  });
}

/** Muda o status da etapa: grava a coluna (fonte) e a marcação nas notas (compatibilidade com leitores antigos). */
export function useSetStepStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ nodeId, status }: { nodeId: string; status: StepStatus }) => {
      // Lê as notas atuais na hora para não sobrescrever edição feita no canvas.
      const [{ data, error }, { data: auth }] = await Promise.all([
        supabase.from("imphq_company_map_nodes").select("notes").eq("id", nodeId).single(),
        supabase.auth.getUser(),
      ]);
      if (error) throw error;
      const { error: updateError } = await supabase.from("imphq_company_map_nodes").update({
        step_status: status,
        status_changed_at: new Date().toISOString(),
        status_changed_by: auth.user?.email ?? "tela",
        notes: writeAgentNotes(data?.notes, { status }),
      }).eq("id", nodeId);
      if (updateError) throw updateError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["today-board"] }),
  });
}

/** Define dono e/ou prazo da etapa (undefined = não mexe; null = limpa). */
export function useSetStepAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ nodeId, ownerId, due }: { nodeId: string; ownerId?: string | null; due?: string | null }) => {
      const patch: { owner_member_id?: string | null; due_date?: string | null } = {};
      if (ownerId !== undefined) patch.owner_member_id = ownerId;
      if (due !== undefined) patch.due_date = due;
      const { error } = await supabase.from("imphq_company_map_nodes").update(patch).eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["today-board"] }),
  });
}

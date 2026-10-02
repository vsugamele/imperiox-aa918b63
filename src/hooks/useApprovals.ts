import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildApprovalQueue, type ApprovalItem } from "@shared/approval-queue";
import { writeAgentNotes, type StepStatus } from "@shared/map-steps";

async function loadApprovals(): Promise<ApprovalItem[]> {
  const [stepsRes, actionsRes, contentsRes, draftsRes, archivedRes] = await Promise.all([
    supabase.from("imphq_company_map_nodes")
      .select("id, map_id, label, description, linked_project_id, status_changed_at, updated_at, image_url")
      .eq("step_status", "ready_review"),
    supabase.from("imphq_ai_actions")
      .select("id, kind, title, reason, risk_level, impact_brl, projeto_id, created_at")
      .eq("status", "proposed").order("created_at").limit(100),
    supabase.from("imphq_content_items")
      .select("id, project_id, title, hook, cover_url, media_url, batch, updated_at, created_at")
      .eq("status", "pronto").limit(100),
    supabase.from("imphq_v_ai_drafts")
      .select("id, project_id, contact_name, incoming_text, suggested_text, created_at")
      .eq("status", "pending").limit(100),
    supabase.from("imphq_company_maps").select("id").not("archived_at", "is", null),
  ]);
  for (const res of [stepsRes, actionsRes, contentsRes, draftsRes, archivedRes]) if (res.error) throw res.error;
  const archived = new Set((archivedRes.data ?? []).map((m) => m.id));
  return buildApprovalQueue({
    steps: (stepsRes.data ?? []).filter((s) => !archived.has(s.map_id)),
    actions: actionsRes.data ?? [],
    contents: contentsRes.data ?? [],
    drafts: draftsRes.data ?? [],
  });
}

/** Fila única "Aprovar": etapas para revisar, ações da IA, conteúdo pronto e respostas da IA pendentes. */
export function useApprovals() {
  return useQuery({ queryKey: ["approvals"], queryFn: loadApprovals, staleTime: 30_000, refetchInterval: 60_000 });
}

export type ApprovalDecision = "approve" | "reject";

async function setStepStatus(nodeId: string, status: StepStatus) {
  const [{ data, error }, { data: auth }] = await Promise.all([
    supabase.from("imphq_company_map_nodes").select("notes").eq("id", nodeId).single(),
    supabase.auth.getUser(),
  ]);
  if (error) throw error;
  const { error: upd } = await supabase.from("imphq_company_map_nodes").update({
    step_status: status, status_changed_at: new Date().toISOString(), status_changed_by: auth.user?.email ?? "tela",
    notes: writeAgentNotes(data?.notes, { status }),
  }).eq("id", nodeId);
  if (upd) throw upd;
}

/**
 * Decide um item da fila, com a mesma ação da tela de origem:
 * etapa → feita / volta para em andamento; ação da IA → imperius-executor / rejeitada; conteúdo → aprovado / reprovado.
 */
export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, decision }: { item: ApprovalItem; decision: ApprovalDecision }) => {
      if (item.source === "etapa") {
        await setStepStatus(item.id, decision === "approve" ? "done" : "in_progress");
      } else if (item.source === "acao_ia") {
        if (decision === "reject") {
          const { error } = await supabase.from("imphq_ai_actions").update({ status: "rejected" }).eq("id", item.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.functions.invoke("imperius-executor", { body: { action_id: item.id, mode: "execute" } });
          if (error) throw error;
          if (!data?.ok) throw new Error(data?.error || "A execução falhou");
        }
      } else if (item.source === "conteudo") {
        const now = new Date().toISOString();
        const { error } = await supabase.from("imphq_content_items")
          .update(decision === "approve" ? { status: "aprovado", approved_at: now, updated_at: now } : { status: "reprovado", updated_at: now })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        throw new Error("Este item é decidido na tela de origem");
      }
    },
    onSuccess: () => {
      for (const key of ["approvals", "today-board", "sidebar-badges"]) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

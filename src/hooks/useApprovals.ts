import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildApprovalQueue, type ApprovalItem } from "@shared/approval-queue";
import { knowledgeGapRows, pixRowsFromSales, splitAdsActions } from "@shared/approval-rows";
import { decideApproval, type ApprovalDecision, type ApprovalStore } from "@shared/approval-decide";
import { writeAgentNotes, type StepStatus } from "@shared/map-steps";
import { toJson } from "@/lib/funis-data";

export type { ApprovalDecision } from "@shared/approval-decide";

async function loadApprovals(): Promise<ApprovalItem[]> {
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [actionsRes, contentsRes, draftsRes, vendasRes, knowledgeRes] = await Promise.all([
    supabase.from("imphq_ai_actions")
      .select("id, kind, title, reason, risk_level, impact_brl, projeto_id, created_at, source, payload")
      .eq("status", "proposed").order("created_at", { ascending: false }).limit(100),
    supabase.from("imphq_content_items")
      .select("id, project_id, title, hook, cover_url, media_url, batch, updated_at, created_at")
      .eq("status", "pronto").limit(100),
    supabase.from("imphq_v_ai_drafts")
      .select("id, project_id, contact_name, incoming_text, suggested_text, created_at")
      .eq("status", "pending").limit(100),
    supabase.from("imphq_vendas")
      .select("id, lead_id, project_id, valor, produto_nome, status, data, nome, created_at")
      .in("status", ["aguardando_pagamento", "pix_gerado", "pendente"])
      .gte("created_at", cutoff48h)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("imphq_wa_knowledge")
      .select("id, project_id, pergunta, resposta, source, created_at")
      // Só o que tem resposta para aprovar e ainda não foi decidido (o Jev decide o resto: KB1.1).
      .eq("aprovada", false).eq("answered", false).not("resposta", "is", null).neq("resposta", "")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  for (const res of [actionsRes, contentsRes, draftsRes]) {
    if (res.error) throw res.error;
  }

  const vendas = vendasRes.data ?? [];
  const leadIds = vendas.map((v) => v.lead_id).filter(Boolean) as string[];
  const leadsMap: Record<string, { nome?: string | null; phone?: string | null }> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from("imphq_leads").select("id, nome, phone").in("id", leadIds.slice(0, 50));
    for (const l of leads ?? []) leadsMap[l.id] = { nome: l.nome, phone: l.phone };
  }
  const { semaforo, generic } = splitAdsActions(actionsRes.data ?? []);

  return buildApprovalQueue({
    steps: [],
    actions: generic,
    contents: contentsRes.data ?? [],
    drafts: draftsRes.data ?? [],
    pix: pixRowsFromSales(vendas, leadsMap),
    semaforo,
    knowledge: knowledgeGapRows(knowledgeRes.data ?? []),
  });
}

/** Fila única "Aprovar": focada em decisões de impacto comercial (Semáforo de anúncios, Pix travados, Dúvidas do bot, Ações IA). */
export function useApprovals() {
  return useQuery({ queryKey: ["approvals"], queryFn: loadApprovals, staleTime: 30_000, refetchInterval: 60_000 });
}

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
 * Decide um item da fila com base na sua categoria:
 * - semaforo_ads: executa pausa/escala via imperius-executor ou rejeita
 * - pix_travado: registra disparo de recuperação ou marca pago
 * - duvida_bot: promove para o acervo oficial (aprovada = true, answered = true)
 * - acao_ia: executa via imperius-executor / rejeita
 * - conteudo: aprova / reprova
 */
/** Acesso ao banco usado pela regra compartilhada de decisão (a mesma do project-mcp). */
const store: ApprovalStore = {
  async getSaleData(id) {
    const { data } = await supabase.from("imphq_vendas").select("data").eq("id", id).single();
    return data?.data && typeof data.data === "object" && !Array.isArray(data.data) ? data.data as Record<string, unknown> : {};
  },
  async updateSale(id, patch) {
    const row = { ...(patch.status ? { status: patch.status } : {}), ...(patch.data ? { data: toJson(patch.data) } : {}) };
    const { error } = await supabase.from("imphq_vendas").update(row).eq("id", id);
    if (error) throw error;
  },
  async updateAiAction(id, patch) { const { error } = await supabase.from("imphq_ai_actions").update(patch).eq("id", id); if (error) throw error; },
  async executeAiAction(id) {
    const { data, error } = await supabase.functions.invoke("imperius-executor", { body: { action_id: id, mode: "execute" } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "A execução falhou");
  },
  async updateKnowledge(id, patch) { const { error } = await supabase.from("imphq_wa_knowledge").update(patch).eq("id", id); if (error) throw error; },
  setStepStatus,
  async updateContent(id, patch) { const { error } = await supabase.from("imphq_content_items").update(patch).eq("id", id); if (error) throw error; },
};

/** Decide um item da fila com a regra compartilhada (_shared/approval-decide.ts). */
export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, decision, customAnswer }: { item: ApprovalItem; decision: ApprovalDecision; customAnswer?: string }) => {
      await decideApproval(item, decision, store, { customAnswer });
    },
    onSuccess: () => {
      for (const key of ["approvals", "today-board", "sidebar-badges"]) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

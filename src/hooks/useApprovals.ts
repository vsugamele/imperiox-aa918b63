import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildApprovalQueue,
  type ApprovalItem,
  type AiActionRow,
  type PixRow,
  type SemaforoRow,
  type KnowledgeGapRow,
} from "@shared/approval-queue";
import { writeAgentNotes, type StepStatus } from "@shared/map-steps";

function cleanFirstName(name?: string | null): string {
  if (!name) return "";
  const first = name.trim().split(/\s+/)[0];
  return first ? ` ${first}` : "";
}

function buildPixRecoveryMessage(name: string | null | undefined, product: string | null | undefined, ageMin: number): string {
  const p = product || "seu pedido";
  const n = cleanFirstName(name);
  if (ageMin < 120) {
    return `Oi${n}! Vi que o pagamento de *${p}* não rolou ainda. Travou em algo? Me fala que resolvo aqui.`;
  }
  if (ageMin < 1440) {
    return `Oi${n}! Ainda dá tempo de fechar o *${p}*. Se ficou alguma dúvida em preço ou formato, me responde por aqui.`;
  }
  return `Oi${n}! Última chamada — sua condição especial para *${p}* expira hoje. Quer que eu segure para você?`;
}

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
      .or("aprovada.eq.false,answered.eq.false")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  for (const res of [actionsRes, contentsRes, draftsRes]) {
    if (res.error) throw res.error;
  }

  // 1. Processa Vendas Pendentes (Pix Travados) com enriquecimento de Lead
  const vendas = vendasRes.data ?? [];
  const leadIds = vendas.map((v) => v.lead_id).filter(Boolean) as string[];
  const leadsMap: Record<string, { nome?: string; phone?: string }> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("imphq_leads")
      .select("id, nome, phone")
      .in("id", leadIds.slice(0, 50));
    if (leads) {
      for (const l of leads) leadsMap[l.id] = { nome: l.nome, phone: l.phone };
    }
  }

  const now = Date.now();
  const pixRows: PixRow[] = vendas.map((v) => {
    const lead = v.lead_id ? leadsMap[v.lead_id] : undefined;
    const vData = (v.data && typeof v.data === "object" ? v.data : {}) as Record<string, any>;
    const phone = lead?.phone || vData.phone || vData.telefone || null;
    const customerName = v.nome || lead?.nome || vData.nome || "Cliente";
    const ageMin = Math.max(0, Math.floor((now - new Date(v.created_at).getTime()) / 60000));
    const recoveryLevel = ageMin < 120 ? 1 : ageMin < 1440 ? 2 : 3;
    const recoveryMessage = buildPixRecoveryMessage(customerName, v.produto_nome, ageMin);

    return {
      id: v.id,
      project_id: v.project_id,
      lead_id: v.lead_id,
      customer_name: customerName,
      customer_phone: phone,
      product_name: v.produto_nome,
      valor: Number(v.valor) || 0,
      created_at: v.created_at,
      recovery_level: recoveryLevel,
      recovery_message: recoveryMessage,
    };
  });

  // 2. Separa Ações de Anúncios (Semáforo) das demais Ações da IA
  const rawActions = (actionsRes.data ?? []) as Array<AiActionRow & { source?: string }>;
  const semaforoRows: SemaforoRow[] = [];
  const genericActions: AiActionRow[] = [];

  for (const a of rawActions) {
    const isAdsAction =
      a.source === "ads-rules-engine" ||
      ["pauseAd", "adjustBudget", "scaleAd"].includes(a.kind) ||
      a.title.toLowerCase().includes("pausar ad") ||
      a.title.toLowerCase().includes("escalar");

    if (isAdsAction) {
      const payload = (a.payload && typeof a.payload === "object" ? a.payload : {}) as Record<string, any>;
      semaforoRows.push({
        id: a.id,
        title: a.title,
        reason: a.reason,
        risk_level: a.risk_level,
        impact_brl: a.impact_brl,
        projeto_id: a.projeto_id,
        created_at: a.created_at,
        entity_id: payload.entity_id,
        entity_name: payload.entity_name || a.title,
        spend_brl: payload.spend_brl ?? a.impact_brl ?? null,
        cpa_brl: payload.cpa_brl,
        meta_cpa_brl: payload.meta_cpa_brl,
        purchases: payload.purchases,
        clicks: payload.clicks,
        recommendation: a.kind === "adjustBudget" || a.title.toLowerCase().includes("escalar") ? "escalar" : "pausar",
      });
    } else {
      genericActions.push(a);
    }
  }

  // 3. Dúvidas do Bot não aprovadas
  const knowledgeRows: KnowledgeGapRow[] = (knowledgeRes.data ?? []).map((k) => ({
    id: k.id,
    project_id: k.project_id,
    pergunta: k.pergunta,
    resposta: k.resposta,
    created_at: k.created_at,
    source: k.source,
  }));

  return buildApprovalQueue({
    steps: [],
    actions: genericActions,
    contents: contentsRes.data ?? [],
    drafts: draftsRes.data ?? [],
    pix: pixRows,
    semaforo: semaforoRows,
    knowledge: knowledgeRows,
  });
}

/** Fila única "Aprovar": focada em decisões de impacto comercial (Semáforo de anúncios, Pix travados, Dúvidas do bot, Ações IA). */
export function useApprovals() {
  return useQuery({ queryKey: ["approvals"], queryFn: loadApprovals, staleTime: 30_000, refetchInterval: 60_000 });
}

export type ApprovalDecision = "approve" | "reject" | "mark_paid";

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
export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      item,
      decision,
      customAnswer,
    }: {
      item: ApprovalItem;
      decision: ApprovalDecision;
      customAnswer?: string;
    }) => {
      const now = new Date().toISOString();

      if (item.source === "pix_travado") {
        if (decision === "mark_paid") {
          const { error } = await supabase
            .from("imphq_vendas")
            .update({ status: "aprovado" })
            .eq("id", item.id);
          if (error) throw error;
        } else if (decision === "approve") {
          // Marca envio de recuperação na venda
          const { data: v } = await supabase.from("imphq_vendas").select("data").eq("id", item.id).single();
          const curData = (v?.data && typeof v.data === "object" ? v.data : {}) as Record<string, any>;
          const sent = Array.isArray(curData.recovery_sent_levels) ? [...curData.recovery_sent_levels] : [];
          const lvl = item.metadata?.recoveryLevel || 1;
          if (!sent.includes(lvl)) sent.push(lvl);

          const { error } = await supabase
            .from("imphq_vendas")
            .update({
              data: { ...curData, recovery_sent_levels: sent, last_recovery_sent_at: now },
            })
            .eq("id", item.id);
          if (error) throw error;
        } else if (decision === "reject") {
          const { error } = await supabase
            .from("imphq_vendas")
            .update({ status: "recuperacao_descartada" })
            .eq("id", item.id);
          if (error) throw error;
        }
      } else if (item.source === "semaforo_ads") {
        if (decision === "reject") {
          const { error } = await supabase.from("imphq_ai_actions").update({ status: "rejected" }).eq("id", item.id);
          if (error) throw error;
        } else {
          // Executa via imperius-executor
          const { data, error } = await supabase.functions.invoke("imperius-executor", {
            body: { action_id: item.id, mode: "execute" },
          });
          if (error) throw error;
          if (!data?.ok) throw new Error(data?.error || "A execução do semáforo falhou");
        }
      } else if (item.source === "duvida_bot") {
        if (decision === "approve") {
          const answer = (customAnswer ?? item.metadata?.suggestedAnswer ?? "").trim();
          const { error } = await supabase
            .from("imphq_wa_knowledge")
            .update({
              aprovada: true,
              answered: true,
              resposta: answer || "Respondido pela equipe.",
              updated_at: now,
            })
            .eq("id", item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("imphq_wa_knowledge")
            .update({ answered: true, aprovada: false, updated_at: now })
            .eq("id", item.id);
          if (error) throw error;
        }
      } else if (item.source === "etapa") {
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


// Decisão de um item da fila Aprovar (IA1.1): a mesma regra para a tela /aprovar e para o project-mcp.
// Quem chama só fornece o acesso ao banco (ApprovalStore); a regra de cada origem fica aqui.
import type { ApprovalSource } from "./approval-queue.ts";
import type { StepStatus } from "./map-steps.ts";

export type ApprovalDecision = "approve" | "reject" | "mark_paid";

export const DECISIONS_BY_SOURCE: Record<ApprovalSource, ApprovalDecision[]> = {
  pix_travado: ["approve", "mark_paid", "reject"],
  semaforo_ads: ["approve", "reject"],
  duvida_bot: ["approve", "reject"],
  rascunho: [],
  etapa: ["approve", "reject"],
  acao_ia: ["approve", "reject"],
  conteudo: ["approve", "reject"],
};

export interface DecisionTarget {
  source: ApprovalSource;
  id: string;
  metadata?: { recoveryLevel?: number; suggestedAnswer?: string } | null;
}

export interface ApprovalStore {
  getSaleData(id: string): Promise<Record<string, unknown>>;
  updateSale(id: string, patch: { status?: string; data?: Record<string, unknown> }): Promise<void>;
  updateAiAction(id: string, patch: { status: string }): Promise<void>;
  /** Executa a ação proposta (imperius-executor). */
  executeAiAction(id: string): Promise<void>;
  updateKnowledge(id: string, patch: { aprovada: boolean; answered: boolean; resposta?: string; updated_at: string }): Promise<void>;
  setStepStatus(id: string, status: StepStatus): Promise<void>;
  updateContent(id: string, patch: { status: string; approved_at?: string; updated_at: string }): Promise<void>;
}

/** O que a decisão fez, em uma frase (vai para o diário e para a resposta da IA). */
export async function decideApproval(
  item: DecisionTarget,
  decision: ApprovalDecision,
  store: ApprovalStore,
  opts: { now?: string; customAnswer?: string } = {},
): Promise<string> {
  const now = opts.now ?? new Date().toISOString();
  if (!DECISIONS_BY_SOURCE[item.source].includes(decision)) throw new Error(`Decisão "${decision}" não vale para ${item.source}`);

  switch (item.source) {
    case "pix_travado": {
      if (decision === "mark_paid") { await store.updateSale(item.id, { status: "aprovado" }); return "Pix marcado como pago"; }
      if (decision === "reject") { await store.updateSale(item.id, { status: "recuperacao_descartada" }); return "Recuperação do pix descartada"; }
      const data = await store.getSaleData(item.id);
      const sent = Array.isArray(data.recovery_sent_levels) ? [...data.recovery_sent_levels] : [];
      const level = item.metadata?.recoveryLevel || 1;
      if (!sent.includes(level)) sent.push(level);
      await store.updateSale(item.id, { data: { ...data, recovery_sent_levels: sent, last_recovery_sent_at: now } });
      return `Recuperação nível ${level} registrada como enviada`;
    }
    case "semaforo_ads":
    case "acao_ia": {
      if (decision === "reject") { await store.updateAiAction(item.id, { status: "rejected" }); return "Ação rejeitada"; }
      await store.executeAiAction(item.id);
      return "Ação executada";
    }
    case "duvida_bot": {
      if (decision === "reject") { await store.updateKnowledge(item.id, { aprovada: false, answered: true, updated_at: now }); return "Dúvida descartada"; }
      const answer = (opts.customAnswer ?? item.metadata?.suggestedAnswer ?? "").trim();
      await store.updateKnowledge(item.id, { aprovada: true, answered: true, resposta: answer || "Respondido pela equipe.", updated_at: now });
      return "Resposta aprovada no acervo do bot";
    }
    case "etapa": {
      await store.setStepStatus(item.id, decision === "approve" ? "done" : "in_progress");
      return decision === "approve" ? "Etapa marcada como feita" : "Etapa devolvida para ajuste";
    }
    case "conteudo": {
      await store.updateContent(item.id, decision === "approve" ? { status: "aprovado", approved_at: now, updated_at: now } : { status: "reprovado", updated_at: now });
      return decision === "approve" ? "Conteúdo aprovado" : "Conteúdo reprovado";
    }
    default:
      throw new Error("Este item é decidido na tela de origem");
  }
}

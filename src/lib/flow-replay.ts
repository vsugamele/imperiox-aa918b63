import type { Tables } from "@/integrations/supabase/types";
import { jsonFields } from "@/lib/json-fields";

type ReplayExecution = Pick<Tables<"imphq_flow_executions">, "lead_id" | "project_id" | "trigger_tipo" | "automacao_id">;
type ReplayLead = Pick<Tables<"imphq_leads">, "id" | "nome" | "phone" | "email" | "tags" | "project_id" | "data">;

export function flowReplayBody(exec: ReplayExecution, lead: ReplayLead | null, fromStep?: number) {
  if (!lead || lead.id !== exec.lead_id || (exec.project_id && lead.project_id !== exec.project_id)) {
    throw new Error("Lead da execução não encontrado neste projeto.");
  }
  if (fromStep !== undefined && (!Number.isInteger(fromStep) || fromStep < 0)) throw new Error("Etapa inválida.");
  return {
    trigger_tipo: exec.trigger_tipo, project_id: exec.project_id, automacao_id: exec.automacao_id,
    lead_data: { ...jsonFields(lead.data), lead_id: lead.id, nome: lead.nome, phone: lead.phone, email: lead.email, tags: lead.tags },
    resume_from_step: fromStep,
  };
}

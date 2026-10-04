// Leads por próxima ação (Story UX2.1): em vez de uma lista por pontuação, grupos que dizem o que fazer agora.
// Regras puras, testáveis; a aba "Agora" de /leads usa isto junto com os motivos de calcHotLead.

export type ActionGroup = "responder" | "pagamento" | "quente" | "reengajar";

export const ACTION_GROUPS: Array<{ key: ActionGroup; label: string; hint: string }> = [
  { key: "responder", label: "Responder agora", hint: "Mandaram mensagem no WhatsApp e estão sem resposta" },
  { key: "pagamento", label: "Pagamento esperando", hint: "Pix ou boleto gerado sem pagar, ou cartão recusado" },
  { key: "quente", label: "Quentes sem contato", hint: "Interagiram há pouco ou têm alta chance de comprar" },
  { key: "reengajar", label: "Reengajar", hint: "Clientes parados há 30 a 90 dias" },
];

const PAYMENT_KEYS = new Set(["pix_recente", "pix_24h", "recusado"]);

/** Grupo do lead pelos motivos de calor (calcHotLead). Pagamento vem antes de tudo. */
export function actionGroupFor(reasons: ReadonlyArray<{ key: string }>): Exclude<ActionGroup, "responder"> {
  if (reasons.some((r) => PAYMENT_KEYS.has(r.key))) return "pagamento";
  if (reasons.length > 0 && reasons.every((r) => r.key === "winback")) return "reengajar";
  return "quente";
}

/** Texto curto do que fazer com o lead. */
export function nextActionText(group: ActionGroup, reasons: ReadonlyArray<{ key: string }>): string {
  if (group === "responder") return "Responder a mensagem";
  if (group === "pagamento") return reasons.some((r) => r.key === "recusado") ? "Oferecer Pix ou outro cartão" : "Ajudar a finalizar o pagamento";
  if (group === "reengajar") return "Mandar uma novidade ou oferta de volta";
  return "Puxar conversa enquanto está quente";
}

export interface ConversationRow {
  id: string;
  phone: string | null;
  contact_name: string | null;
  project_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  jid_suffix: string | null;
}

export interface WaitingConversation { id: string; nome: string; phone: string | null; project_id: string | null; preview: string; waitingMin: number }

/** Conversas individuais cuja última mensagem é do cliente, nas últimas `maxHours` horas; quem espera há mais tempo primeiro. */
export function waitingConversations(rows: ReadonlyArray<ConversationRow>, now: number = Date.now(), maxHours = 48): WaitingConversation[] {
  return rows
    .filter((r) => r.last_message_direction === "incoming" && r.jid_suffix !== "g.us" && r.last_message_at)
    .map((r) => ({ r, waitingMin: Math.max(0, Math.floor((now - Date.parse(r.last_message_at!)) / 60_000)) }))
    .filter(({ waitingMin }) => waitingMin <= maxHours * 60)
    .sort((a, b) => b.waitingMin - a.waitingMin)
    .map(({ r, waitingMin }) => ({
      id: r.id,
      nome: r.contact_name || r.phone || "Sem nome",
      phone: r.phone,
      project_id: r.project_id,
      preview: (r.last_message || "").replace(/\s+/g, " ").slice(0, 120),
      waitingMin,
    }));
}

export function waitingLabel(min: number): string {
  if (min < 60) return `esperando há ${min} min`;
  if (min < 24 * 60) return `esperando há ${Math.floor(min / 60)} h`;
  return `esperando há ${Math.floor(min / (24 * 60))} dia(s)`;
}

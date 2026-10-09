// Lead esperando resposta no WhatsApp (OF2.1): regra pura, testável fora do Deno. Quem busca e envia é o wa-waiting-alert.
// Um aviso por "espera" (conversa + horário da última mensagem do lead); nada entre 22h e 8h de Brasília.

export interface WaitingConv {
  id: string;
  project_id: string | null;
  phone: string | null;
  nome?: string | null;
  contact_name?: string | null;
  last_message?: string | null;
  last_incoming_at: string | null;
  last_message_direction: string | null;
  ia_ativa?: boolean | null;
  ai_paused?: boolean | null;
  ai_paused_until?: string | null;
  assigned_to?: string | null;
  snoozed_until?: string | null;
  jid_suffix?: string | null;
}

export interface WaitingItem { c: string; t: string; projeto: string; nome: string; fone: string; horas: number; motivo: string; trecho: string }

export const WAIT_MIN_MINUTES = 60;
export const WAIT_MAX_HOURS = 48;
const MAX_LISTED = 10;

/** Hora de Brasília (UTC-3, sem horário de verão). */
export function brtHour(now: Date): number {
  return (now.getUTCHours() + 21) % 24;
}

export function quietHours(now: Date): boolean {
  const h = brtHour(now);
  return h < 8 || h >= 22;
}

function isGroup(c: WaitingConv): boolean {
  return (c.jid_suffix || "").includes("g.us") || (c.phone || "").includes("@g.us") || (c.phone || "").replace(/\D/g, "").length > 15;
}

function motivo(c: WaitingConv, now: number): string {
  const pausada = c.ai_paused === true || (c.ai_paused_until ? Date.parse(c.ai_paused_until) > now : false);
  const base = c.ia_ativa === false ? "IA desligada" : pausada ? "IA pausada" : "IA ligada e não respondeu";
  return c.assigned_to ? `${base}, com responsável` : `${base}, sem responsável`;
}

/** Conversas cujo lead falou por último há mais de 60 min (e menos de 48 h) e que ainda não viraram aviso. */
export function pickWaiting(convs: WaitingConv[], alreadySent: Set<string>, projectNames: Record<string, string>, nowDate: Date): WaitingItem[] {
  const now = nowDate.getTime();
  const out: WaitingItem[] = [];
  for (const c of convs) {
    if (!c.last_incoming_at || c.last_message_direction !== "incoming" || isGroup(c)) continue;
    if (c.snoozed_until && Date.parse(c.snoozed_until) > now) continue;
    const waitedMs = now - Date.parse(c.last_incoming_at);
    if (!(waitedMs >= WAIT_MIN_MINUTES * 60000 && waitedMs <= WAIT_MAX_HOURS * 3600000)) continue;
    if (alreadySent.has(`${c.id}|${c.last_incoming_at}`)) continue;
    const digits = (c.phone || "").replace(/\D/g, "");
    out.push({
      c: c.id,
      t: c.last_incoming_at,
      projeto: (c.project_id && projectNames[c.project_id]) || c.project_id || "sem projeto",
      nome: (c.nome || c.contact_name || "Sem nome").trim(),
      fone: digits ? `…${digits.slice(-4)}` : "",
      horas: Math.round(waitedMs / 360000) / 10,
      motivo: motivo(c, now),
      trecho: (c.last_message || "").replace(/\s+/g, " ").trim().slice(0, 80),
    });
  }
  return out.sort((a, b) => b.horas - a.horas);
}

export function formatWaiting(items: WaitingItem[]): string {
  const lines = items.slice(0, MAX_LISTED).map((i) =>
    `• ${i.nome} ${i.fone} (${i.projeto}) — ${String(i.horas).replace(".", ",")}h — ${i.motivo}${i.trecho ? `\n  “${i.trecho}”` : ""}`);
  const extra = items.length > MAX_LISTED ? `\n…e mais ${items.length - MAX_LISTED}.` : "";
  return `⏳ ${items.length === 1 ? "1 lead esperando" : `${items.length} leads esperando`} resposta no WhatsApp há mais de 1h:\n\n${lines.join("\n")}${extra}`;
}

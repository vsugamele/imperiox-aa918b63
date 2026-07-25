// Cor semântica por status da conversa no Inbox.
// Regra clara e determinística: override manual > handoff > sla > frio > nova > default.

export type ConvColorKey =
  | "override"
  | "handoff"
  | "urgent"
  | "waiting"
  | "new"
  | "cold"
  | "snoozed"
  | "interested"
  | "default";

export interface ConvColor {
  key: ConvColorKey;
  hex: string;      // borda / dot
  bg: string;       // tailwind bg utility
  ring: string;     // tailwind ring utility
  label: string;
}

export const CONV_COLOR_PRESETS: Record<string, { hex: string; label: string; bg: string; ring: string }> = {
  blue:    { hex: "#3b82f6", label: "Interessado em comprar", bg: "bg-blue-500/10",    ring: "ring-blue-400/50" },
  green:   { hex: "#10b981", label: "Nova mensagem",          bg: "bg-emerald-500/10", ring: "ring-emerald-400/50" },
  amber:   { hex: "#f59e0b", label: "Aguardando resposta",    bg: "bg-amber-500/10",   ring: "ring-amber-400/50" },
  red:     { hex: "#ef4444", label: "Urgente / SLA estourou", bg: "bg-red-500/10",     ring: "ring-red-400/50" },
  violet:  { hex: "#a855f7", label: "Handoff — precisa humano", bg: "bg-violet-500/10", ring: "ring-violet-400/50" },
  slate:   { hex: "#64748b", label: "Frio / arquivado",       bg: "bg-slate-500/10",   ring: "ring-slate-400/40" },
  pink:    { hex: "#ec4899", label: "VIP / atenção especial", bg: "bg-pink-500/10",    ring: "ring-pink-400/50" },
  cyan:    { hex: "#06b6d4", label: "Cliente ativo",          bg: "bg-cyan-500/10",    ring: "ring-cyan-400/50" },
};

export interface ConvForColor {
  status?: string | null;
  handoff_at?: string | null;
  snoozed_until?: string | null;
  last_message_at?: string | null;
  last_message_direction?: string | null;
  unread_count?: number | null;
  last_message?: string | null;
  color_override?: string | null;
  metadata?: any;
}

const INTEREST_KEYWORDS = /\b(quero comprar|pode mandar (o )?(pix|link|boleto)|como (eu )?compro|preço|pre[çc]o|valor|quanto (custa|é|fica)|fechar|garantir|adquirir|checkout|link de pagamento)\b/i;

function isInterested(c: ConvForColor): boolean {
  const meta = c.metadata || {};
  if (meta.hot_lead === true || meta.intent === "buy" || meta.last_intent === "buy") return true;
  if (meta.last_intent_at) {
    const t = new Date(meta.last_intent_at).getTime();
    if (Date.now() - t < 1000 * 60 * 60 * 24 * 2) return true; // últimas 48h
  }
  const msg = c.last_message || "";
  if (msg && INTEREST_KEYWORDS.test(msg)) return true;
  return false;
}

function waitingMinutes(c: ConvForColor): number | null {
  const dir = c.last_message_direction;
  if (dir !== "in" && dir !== "incoming") return null;
  if (!c.last_message_at) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(c.last_message_at).getTime()) / 60000));
}

export function resolveConvColor(c: ConvForColor): ConvColor {
  // 1) Override manual
  if (c.color_override && CONV_COLOR_PRESETS[c.color_override]) {
    const p = CONV_COLOR_PRESETS[c.color_override];
    return { key: "override", hex: p.hex, bg: p.bg, ring: p.ring, label: p.label };
  }

  // 2) Snoozed no futuro
  if (c.snoozed_until && new Date(c.snoozed_until).getTime() > Date.now()) {
    const p = CONV_COLOR_PRESETS.slate;
    return { key: "snoozed", hex: p.hex, bg: p.bg, ring: p.ring, label: "Silenciada" };
  }

  // 3) Handoff / precisa humano
  if (c.handoff_at || c.status === "needs_human" || c.status === "handoff") {
    const p = CONV_COLOR_PRESETS.violet;
    return { key: "handoff", hex: p.hex, bg: p.bg, ring: p.ring, label: "Handoff" };
  }

  // 4) Interessado em comprar (azul)
  if (isInterested(c)) {
    const p = CONV_COLOR_PRESETS.blue;
    return { key: "interested", hex: p.hex, bg: p.bg, ring: p.ring, label: p.label };
  }

  // 5) SLA
  const w = waitingMinutes(c);
  if (w !== null) {
    if (w >= 120) {
      const p = CONV_COLOR_PRESETS.red;
      return { key: "urgent", hex: p.hex, bg: p.bg, ring: p.ring, label: "SLA crítico" };
    }
    if (w >= 30) {
      const p = CONV_COLOR_PRESETS.amber;
      return { key: "waiting", hex: p.hex, bg: p.bg, ring: p.ring, label: "Aguardando resposta" };
    }
  }

  // 6) Não lida recente = verde
  if ((c.unread_count || 0) > 0) {
    const p = CONV_COLOR_PRESETS.green;
    return { key: "new", hex: p.hex, bg: p.bg, ring: p.ring, label: "Nova" };
  }

  // 7) Frio: sem atividade > 7 dias
  const last = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
  if (last && Date.now() - last > 1000 * 60 * 60 * 24 * 7) {
    const p = CONV_COLOR_PRESETS.slate;
    return { key: "cold", hex: p.hex, bg: p.bg, ring: p.ring, label: "Frio" };
  }

  return { key: "default", hex: "transparent", bg: "", ring: "", label: "" };
}

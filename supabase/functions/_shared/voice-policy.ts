// Regras de voz da IA no WhatsApp (TTS de resposta e STT de áudio recebido).
// TS puro e sem dependências: usado pelo wa-ai-reply e testável no vitest.
// Motivação: auditoria de 30/09 (docs/sessions/2026-09/2026-09-30-jp-auditoria-elevenlabs.md) — 157 áudios
// gerados e recusados, gatilhos amplos, sem trava de saldo, sem reaproveitar arquivo e sem limite por conversa.

export type VoiceLogStatus =
  | "generated" | "reused" | "sent" | "send_failed" | "tts_failed" | "quota_exceeded" | "skipped" | "transcribed" | "stt_failed";

export interface VoiceLogEntry {
  kind: "tts" | "stt";
  status: VoiceLogStatus;
  conversation_id: string | null;
  text_hash?: string | null;
  voice_id?: string | null;
  audio_url?: string | null;
  created_at: string;
}

export const VOICE_LIMITS = {
  /** Áudios de resposta por conversa em 24h (etapa de fluxo que força áudio não conta). */
  maxPerConversationPerDay: 2,
  /** Falhas seguidas (geração ou envio) no projeto que pausam a voz. */
  maxConsecutiveFailures: 3,
  /** Pausa depois das falhas seguidas, em horas. */
  failurePauseHours: 6,
  /** Depois de "saldo esgotado" do provedor, não tenta de novo por este tempo (minutos). */
  quotaCooldownMinutes: 60,
  /** Reaproveita um áudio já gerado para o mesmo texto e voz por até estes dias. */
  cacheDays: 7,
} as const;

/** Momento emocional: sem palavras genéricas de rotina ("hoje", "amanhã", "ajuda", "urgente", "prazo"). */
export const EMOTIONAL_RE = /\b(problema|dificuldade|perdi|perda|não consigo|desempregad|dívida|medo|ansiedade|filho|esposa|marido|família|separad|câncer|doença|preciso muito|desesperad[oa]|socorro)\b/i;
/** Intenção de compra: sem "acesso"/"entrar", que são assunto de suporte. */
export const BUYING_RE = /\b(quanto|preço|valor|parcela|desconto|forma de pagamento|pix|boleto|cartão|comprar|fechar|garantia)\b/i;

export type VoiceTrigger =
  | "flow_step_forced" | "lead_sent_audio_mirror" | "lead_audio_recent" | "first_contact"
  | "return_after_silence" | "emotional_moment" | "hot_lead_buying";

export type VoiceBlock =
  | "draft_mode" | "group_or_broadcast" | "provider_without_audio" | "quota_cooldown"
  | "failure_pause" | "conversation_daily_cap" | "no_trigger";

export interface VoiceDecisionInput {
  trigger: VoiceTrigger | null;
  draftMode: boolean;
  /** jid_suffix da conversa ou destino com @g.us/@broadcast. */
  isGroupOrBroadcast: boolean;
  providerSupportsAudio: boolean;
  conversationId: string;
  /** Registros de voz do projeto nas últimas 24h, do mais recente para o mais antigo. */
  recentLog: ReadonlyArray<VoiceLogEntry>;
  now: Date;
}

export interface VoiceDecision { useVoice: boolean; reason: VoiceTrigger | null; blockedBy: VoiceBlock | null }

const minutesBetween = (a: Date, b: string) => (a.getTime() - new Date(b).getTime()) / 60000;

/** Saldo esgotado registrado há menos de quotaCooldownMinutes (vale para TTS e STT: mesma conta). */
export function inQuotaCooldown(log: ReadonlyArray<VoiceLogEntry>, now: Date): boolean {
  return log.some((e) => e.status === "quota_exceeded" && minutesBetween(now, e.created_at) < VOICE_LIMITS.quotaCooldownMinutes);
}

/** 3 falhas seguidas de TTS (sem nenhum sucesso entre elas) dentro da janela de pausa. */
export function inFailurePause(log: ReadonlyArray<VoiceLogEntry>, now: Date): boolean {
  let failures = 0;
  for (const e of log) {
    if (e.kind !== "tts") continue;
    if (e.status === "sent") break;
    if (e.status === "send_failed" || e.status === "tts_failed" || e.status === "quota_exceeded") {
      if (minutesBetween(now, e.created_at) > VOICE_LIMITS.failurePauseHours * 60) break;
      failures += 1;
      if (failures >= VOICE_LIMITS.maxConsecutiveFailures) return true;
    }
  }
  return false;
}

export function decideVoice(input: VoiceDecisionInput): VoiceDecision {
  const block = (blockedBy: VoiceBlock): VoiceDecision => ({ useVoice: false, reason: input.trigger, blockedBy });
  if (!input.trigger) return block("no_trigger");
  if (input.draftMode) return block("draft_mode");
  if (input.isGroupOrBroadcast) return block("group_or_broadcast");
  if (!input.providerSupportsAudio) return block("provider_without_audio");
  if (inQuotaCooldown(input.recentLog, input.now)) return block("quota_cooldown");
  if (inFailurePause(input.recentLog, input.now)) return block("failure_pause");
  if (input.trigger !== "flow_step_forced") {
    const sentToday = input.recentLog.filter((e) =>
      e.kind === "tts" && e.status === "sent" && e.conversation_id === input.conversationId &&
      minutesBetween(input.now, e.created_at) < 24 * 60).length;
    if (sentToday >= VOICE_LIMITS.maxPerConversationPerDay) return block("conversation_daily_cap");
  }
  return { useVoice: true, reason: input.trigger, blockedBy: null };
}

/** Hash estável (FNV-1a 32 bits) de voz + texto para reaproveitar áudio já gerado. */
export function voiceTextHash(voiceId: string, text: string): string {
  const input = `${voiceId}\u0000${text.trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}-${input.length}`;
}

/** Áudio já gerado para o mesmo texto e voz, ainda dentro do prazo de cache. */
export function cachedAudioUrl(log: ReadonlyArray<VoiceLogEntry>, hash: string, now: Date): string | null {
  const hit = log.find((e) => e.kind === "tts" && e.text_hash === hash && !!e.audio_url &&
    (e.status === "generated" || e.status === "reused" || e.status === "sent" || e.status === "send_failed") &&
    minutesBetween(now, e.created_at) < VOICE_LIMITS.cacheDays * 24 * 60);
  return hit?.audio_url ?? null;
}

/** Resposta de "saldo esgotado" do provedor (ElevenLabs devolve quota_exceeded no corpo). */
export function isQuotaError(status: number, body: string): boolean {
  return /quota_exceeded|insufficient_quota|exceeds your quota|credits/i.test(body) || status === 402;
}

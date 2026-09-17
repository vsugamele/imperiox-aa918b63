import { parseConfig, type Config } from "./engine.ts";

export type NativeCinnaAction = Record<string, unknown> & { tipo: string };
export const cinnaRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function isNativeCinna(actions: unknown): boolean {
  return Array.isArray(actions) && actions.some(action => cinnaRecord(action) &&
    (action.cinna_stage !== undefined || action.cinna_policy !== undefined));
}

/** The editable native messages are the source of truth; no hidden script copy. */
export function compileNativeCinna(value: unknown): {
  config: Config; model: string; waitSteps: number[]; actions: NativeCinnaAction[];
} {
  if (!Array.isArray(value)) throw new Error("Cinna actions must be an array");
  const actions: NativeCinnaAction[] = value.map(action => {
    if (!cinnaRecord(action) || typeof action.tipo !== "string") throw new Error("Invalid Cinna action");
    return { ...action, tipo: action.tipo };
  });
  const stages: unknown[] = [];
  const waitSteps: number[] = [];
  let messages: string[] = [];
  let stageDelay = 0;
  let policy: Record<string, unknown> | undefined;
  for (const [index, action] of actions.entries()) {
    if (Number(action.delay_min ?? 0) !== 0 || Number(action.timeout_min ?? 0) !== 0) throw new Error("Cinna does not support minute delays or reply timeouts; use short delay_sec pacing");
    const seconds = Number(action.delay_sec ?? 0);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5) throw new Error("Cinna pacing must be between 0 and 5 seconds");
    stageDelay += seconds;
    if (stageDelay > 20) throw new Error("Cinna stage pacing exceeds 20 seconds");
    if ((action.next_id && action.next_id !== actions[index + 1]?.id) || action.true_next_id || action.false_next_id) {
      throw new Error("Cinna currently requires sequential actions");
    }
    if (action.media !== undefined && action.media !== null) {
      if (!cinnaRecord(action.media) || typeof action.media.url !== "string") throw new Error("Invalid Cinna media");
      const url = new URL(action.media.url);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Cinna media requires HTTPS without credentials");
    }
    if (action.tipo === "whatsapp") {
      const message = action.template ?? action.mensagem ?? action.texto;
      if ([action.template, action.mensagem, action.texto].filter(value => typeof value === "string" && value.trim()).some(value => value !== message)) throw new Error("Conflicting Cinna text fields");
      if (typeof message === "string" && message.trim()) messages.push(message);
      else if (!cinnaRecord(action.media) || typeof action.media.url !== "string" || !action.media.url.startsWith("https://")) throw new Error("Empty Cinna message");
    } else if (action.tipo === "audio") {
      if (!cinnaRecord(action.media) || typeof action.media.url !== "string" || !action.media.url.startsWith("https://")) throw new Error("Cinna audio requires an HTTPS media URL");
    } else if (action.tipo === "wait_reply" && cinnaRecord(action.cinna_stage)) {
      if (messages.length < 2) throw new Error("Cinna stage requires a message and a question");
      if (action.cinna_policy !== undefined) {
        if (policy || stages.length !== 0 || !cinnaRecord(action.cinna_policy)) throw new Error("Cinna policy must appear once on the first wait");
        policy = action.cinna_policy;
      }
      stages.push({ ...action.cinna_stage, messages: messages.slice(0, -1), question: messages.at(-1) });
      waitSteps.push(index);
      messages = [];
      stageDelay = 0;
    } else throw new Error("Unsupported action inside Cinna flow");
  }
  if (!policy || messages.length) throw new Error("Incomplete Cinna flow");
  if (typeof policy.model !== "string" || !policy.model.trim()) throw new Error("Missing Cinna model");
  return { config: parseConfig({ ...policy, stages }), model: policy.model, waitSteps, actions };
}

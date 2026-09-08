import { composeConsultativeReply, type ConsultativeComposer, type ConsultativeMessage } from "../../../src/lib/cinna-shield-x1/consultative.ts";
import { compileNativeCinna, cinnaRecord, isNativeCinna } from "../../../src/lib/cinna-shield-x1/native-contract.ts";
import { decide, initialState, validateState, type State, type Decision, type Classifier } from "../cinna-shield-x1/engine.ts";
export { compileNativeCinna, isNativeCinna };

export interface CinnaRuntime {
  snapshot: ReturnType<typeof compileNativeCinna>;
  state: State;
  pending?: { eventId: string; decision: Decision; messages: string[]; confirmed: number; uncertain: boolean };
  resumeToken?: string;
}
export function createCinnaRuntime(actions: unknown): CinnaRuntime {
  const snapshot = compileNativeCinna(actions);
  return { snapshot, state: initialState(snapshot.config) };
}
export function readCinnaRuntime(results: unknown): CinnaRuntime | null {
  if (!Array.isArray(results)) return null;
  const row = results.find(item => cinnaRecord(item) && item.tipo === "cinna_runtime");
  if (!row) return null;
  if (!cinnaRecord(row.runtime) || !cinnaRecord(row.runtime.snapshot)) throw new Error("Invalid Cinna runtime snapshot");
  const snapshot = compileNativeCinna(row.runtime.snapshot.actions);
  validateState(row.runtime.state, snapshot.config);
  // Pending deliveries must never be reconstructed/retried automatically after a crash.
  if (row.runtime.pending !== undefined) throw new Error("Cinna delivery pending; manual reconciliation required");
  return { snapshot, state: row.runtime.state,
    ...(typeof row.runtime.resumeToken === "string" ? { resumeToken: row.runtime.resumeToken } : {}) };
}
export function writeCinnaRuntime(results: unknown, runtime: CinnaRuntime): Record<string, unknown>[] {
  const previous = Array.isArray(results) ? results.filter(cinnaRecord).filter(row => row.tipo !== "cinna_runtime") : [];
  return [...previous, { step: -1, tipo: "cinna_runtime", runtime }];
}
/** Append only after every reply delivery was confirmed. No message text or captured answers in telemetry. */
export function recordCinnaTurn(results: unknown, runtime: CinnaRuntime, decision: Decision, eventId: string, at: string) {
  const rows = Array.isArray(results) ? results.filter(cinnaRecord) : [];
  if (decision.action === "ignored" || rows.some(row => row.tipo === "cinna_turn" && row.event_id === eventId)) return rows;
  const index = runtime.state.stageIndex;
  return [...rows, { step: runtime.snapshot.waitSteps[index], tipo: "cinna_turn", status: "confirmed",
    event_id: eventId, timestamp: at, stage_id: runtime.snapshot.config.stages[index].id,
    from_stage: index, to_stage: decision.state.stageIndex, action: decision.action,
    intent: decision.intent, source: decision.source, version: runtime.snapshot.config.version }];
}
/** Next-stage messages belong exclusively to the native executor. */
export async function planCinnaReply(runtime: CinnaRuntime, currentStep: number, eventId: string, message: string, classify?: Classifier, consultative?: { compose: ConsultativeComposer; history: ConsultativeMessage[] }) {
  if (runtime.pending) throw new Error("Cinna delivery pending; manual reconciliation required");
  if (runtime.snapshot.waitSteps[runtime.state.stageIndex] !== currentStep) throw new Error("Cinna cursor mismatch");
  if (!message.trim()) throw new Error("Empty Cinna reply");
  const decision = await decide(runtime.snapshot.config, { state: runtime.state, eventId, message }, classify);
  const choice = runtime.snapshot.config.stages[runtime.state.stageIndex].choices?.find(item => item.label.toLowerCase() === message.trim().toLowerCase());
  let messages = decision.action === "advance" ? (choice ? [choice.acknowledgement] : []) : decision.messages;
  let contextual = false;
  if (consultative) {
    const composed = await composeConsultativeReply(runtime.snapshot.config, decision, message, consultative.history, consultative.compose);
    if (composed) { messages = composed; contextual = true; }
  }
  return { decision, messages, contextual, resumeStep: decision.action === "advance" ? currentStep + 1 : null };
}

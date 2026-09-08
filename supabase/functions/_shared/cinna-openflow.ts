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
/** Next-stage messages belong exclusively to the native executor. */
export async function planCinnaReply(runtime: CinnaRuntime, currentStep: number, eventId: string, message: string, classify?: Classifier) {
  if (runtime.pending) throw new Error("Cinna delivery pending; manual reconciliation required");
  if (runtime.snapshot.waitSteps[runtime.state.stageIndex] !== currentStep) throw new Error("Cinna cursor mismatch");
  if (!message.trim()) throw new Error("Empty Cinna reply");
  const decision = await decide(runtime.snapshot.config, { state: runtime.state, eventId, message }, classify);
  const choice = runtime.snapshot.config.stages[runtime.state.stageIndex].choices?.find(item => item.label.toLowerCase() === message.trim().toLowerCase());
  const messages = decision.action === "advance" ? (choice ? [choice.acknowledgement] : []) : decision.messages;
  return { decision, messages, resumeStep: decision.action === "advance" ? currentStep + 1 : null };
}

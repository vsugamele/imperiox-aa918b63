import { jsonFields, jsonText } from "@/lib/json-fields";

export interface JourneyExecution {
  id: string; lead_id: string | null; channel_session_id: string | null;
  status: string; current_step: number; created_at: string; updated_at: string;
  error_message: string | null; step_results: unknown;
}
export interface JourneyStage {
  id: string; title: string; index: number; start: number; wait: number;
  reached: boolean; responded: boolean; advanced: boolean; waiting: boolean;
  human: boolean; stopped: boolean; checkout: boolean; holds: number;
  enteredAt: string | null;
}
export interface JourneyTurn {
  id: string; at: string; stageId: string; action: string; intent: string;
}
export interface JourneyConversation {
  id: string; leadId: string | null; sessionId: string | null; version: string;
  createdAt: string; updatedAt: string; status: string; stageTitle: string;
  stages: JourneyStage[]; turns: JourneyTurn[];
}
export interface JourneyMetric {
  key: string; version: string; id: string; title: string; index: number;
  reached: number; responded: number; advanced: number; waiting: number;
  human: number; stopped: number; checkout: number; holds: number;
}
export const journeyStatusLabels: Record<string, string> = {
  waiting: "Aguardando resposta", running: "Em andamento", human: "Encaminhado para atendimento",
  stopped: "Encerrado a pedido", checkout: "Link de compra enviado", complete: "Conversa concluída",
  completed: "Execução concluída", failed: "Falha", review: "Entrega a conferir", cancelled: "Cancelada",
};
const delivered = new Set(["sent", "completed", "success", "waiting_reply"]);

/** Read the executed snapshot, never the currently edited flow. Pending snapshots are observable, not resumable. */
export function readJourney(row: JourneyExecution): JourneyConversation | null {
  const results = Array.isArray(row.step_results) ? row.step_results.map(jsonFields) : [];
  const runtime = jsonFields(results.find(item => item.tipo === "cinna_runtime")?.runtime);
  const snapshot = jsonFields(runtime.snapshot);
  if (!Array.isArray(snapshot.actions)) return null;
  const actions = snapshot.actions.map(jsonFields);
  const state = jsonFields(runtime.state);
  const stages: JourneyStage[] = [];
  let start = 0;
  for (const [wait, action] of actions.entries()) {
    const stage = jsonFields(action.cinna_stage);
    if (action.tipo !== "wait_reply" || !jsonText(stage.id)) continue;
    stages.push({ id: jsonText(stage.id), title: jsonText(stage.title) || jsonText(stage.id),
      index: stages.length, start, wait, reached: false, responded: false, advanced: false,
      waiting: false, human: false, stopped: false, checkout: false, holds: 0, enteredAt: null });
    start = wait + 1;
  }
  if (!stages.length) return null;
  const seen = new Set<string>();
  const turns: JourneyTurn[] = [];
  for (const result of results) {
    if (result.tipo === "cinna_runtime") continue;
    if (result.tipo === "cinna_turn") {
      const id = jsonText(result.event_id);
      const stage = stages.find(item => item.id === result.stage_id);
      if (!id || !stage || seen.has(id) || result.status !== "confirmed") continue;
      seen.add(id);
      const action = jsonText(result.action);
      stage.reached = true;
      stage.responded = true;
      stage.advanced ||= action === "advance";
      stage.human ||= action === "human";
      stage.stopped ||= action === "stop";
      stage.checkout ||= action === "checkout";
      if (action === "hold") stage.holds++;
      turns.push({ id, at: jsonText(result.timestamp), stageId: stage.id, action, intent: jsonText(result.intent) });
      continue;
    }
    const step = typeof result.step === "number" ? result.step : -1;
    const stage = stages.find(item => step >= item.start && step <= item.wait);
    if (!stage || !delivered.has(jsonText(result.status))) continue;
    stage.reached = true;
    const time = jsonText(result.started_at) || jsonText(result.timestamp);
    if (time && Number.isFinite(Date.parse(time)) && (!stage.enteredAt || Date.parse(time) < Date.parse(stage.enteredAt))) stage.enteredAt = time;
  }
  const stateStatus = jsonText(state.status);
  const last = stages.filter(stage => stage.reached).at(-1);
  const latestDelivery = new Map<number, string>();
  for (const result of results) if (typeof result.step === "number" && result.step >= 0 && result.tipo !== "cinna_turn") latestDelivery.set(result.step, jsonText(result.status));
  const pending = Boolean(runtime.pending) || Boolean(row.error_message) || [...latestDelivery.values()].includes("delivery_pending");
  for (const stage of stages) stage.waiting = !pending && stateStatus === "active" && row.status === "waiting"
    && row.current_step === stage.wait && stage.reached;
  const status = pending ? "review" : row.status === "cancelled" || row.status === "failed" ? row.status
    : state.checkoutSent === true ? "checkout" : ["human", "stopped", "complete"].includes(stateStatus) ? stateStatus : row.status;
  return { id: row.id, leadId: row.lead_id, sessionId: row.channel_session_id,
    version: jsonText(state.version) || jsonText(jsonFields(snapshot.config).version) || "Sem versão",
    createdAt: row.created_at, updatedAt: row.updated_at, status,
    stageTitle: last?.title || "Ainda sem etapa entregue", stages, turns };
}

/** Count each execution once per stage. Multiple holds/retries never inflate stage reach. */
export function journeyMetrics(conversations: JourneyConversation[]): JourneyMetric[] {
  const metrics = new Map<string, JourneyMetric>();
  for (const conversation of conversations) for (const stage of conversation.stages) {
    const key = `${conversation.version}:${stage.id}`;
    const metric = metrics.get(key) || { key, version: conversation.version, id: stage.id, title: stage.title,
      index: stage.index, reached: 0, responded: 0, advanced: 0, waiting: 0, human: 0, stopped: 0, checkout: 0, holds: 0 };
    for (const field of ["reached", "responded", "advanced", "waiting", "human", "stopped", "checkout"] as const) metric[field] += Number(stage[field]);
    metric.holds += stage.holds;
    metrics.set(key, metric);
  }
  return [...metrics.values()].sort((a, b) => a.version.localeCompare(b.version) || a.index - b.index);
}

export function safeJourneyMedia(value: string | null): string | null {
  try { const url = new URL(value || ""); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

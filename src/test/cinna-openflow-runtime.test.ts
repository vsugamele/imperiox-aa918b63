import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { toNativeCinnaFlow } from "@/lib/cinna-shield-x1/openflow";
import { compileNativeCinna, isNativeCinna } from "@/lib/cinna-shield-x1/native-contract";
import { createCinnaRuntime, readCinnaRuntime, writeCinnaRuntime, planCinnaReply } from "../../supabase/functions/_shared/cinna-openflow";

const actions = () => toNativeCinnaFlow(JSON.parse(readFileSync(resolve("src/test/fixtures/cinna-legacy.json"), "utf8")), "model");
type Handler = (req: Request) => Promise<Response>;
function app(message: string, failAt = -1, ana = false) {
  const flow = ana ? toNativeCinnaFlow(JSON.parse(readFileSync(resolve("scripts/cinna-shield-x1/flow.yaml"), "utf8")), "model") : actions();
  const runtime = createCinnaRuntime(flow);
  const execution: Record<string, unknown> = { id: "execution", automacao_id: "flow", current_step: runtime.snapshot.waitSteps[0],
    trigger_tipo: "webchat_mensagem_recebida", status: "waiting", step_results: writeCinnaRuntime([], runtime), error_message: null };
  const session = { id: "session", project_id: "cinna-shield", canal: "webchat", external_id: "visitor", meta: {} };
  const event = { id: "persisted-event", texto: message };
  const updates: Record<string, unknown>[] = [];
  function from(table: string) {
    const filters: [string, unknown][] = [];
    let patch: Record<string, unknown> | undefined;
    const result = () => {
      if (table === "imphq_channel_sessions") return { data: session, error: null };
      if (table === "imphq_automacoes") return { data: { id: "flow", nome: "Cinna", acoes: flow }, error: null };
      if (table === "imphq_channel_messages") return { data: event, error: null };
      const matches = filters.every(([key, value]) => key === "step_results" ? JSON.stringify(execution[key]) === value :
        key === "channel_session_id" || execution[key] === value);
      if (patch && matches) { updates.push(structuredClone(patch)); Object.assign(execution, structuredClone(patch)); }
      return { data: matches ? structuredClone(execution) : null, error: null };
    };
    const chain = {
      select: (_columns: string) => chain, eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
      in: (_key: string, _values: string[]) => chain, order: (_key: string, _options: unknown) => chain,
      limit: (_count: number) => chain, update: (value: Record<string, unknown>) => { patch = value; return chain; },
      maybeSingle: async () => result(), then: (resolveResult: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolveResult),
    };
    return chain;
  }
  let handler: Handler | undefined;
  const send = vi.fn(async () => ({ success: send.mock.calls.length !== failAt }));
  const fetchMock = vi.fn(async () => {
    execution.current_step = runtime.snapshot.waitSteps[1]; execution.status = "waiting";
    return Response.json({ ok: true });
  });
  const ai = vi.fn(async (request: { tag?: string }) => ({ content: JSON.stringify(request.tag === "cinna-native-consultative"
    ? { acknowledgementId: "concern", snippetIds: [], questionId: "clarify" } : { intent: "question" }) }));
  const source = readFileSync(resolve("supabase/functions/channel-ai-reply/index.ts"), "utf8").replace(/^import .*;\r?\n/gm, "");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function("Deno", "z", "createClient", "corsHeaders", "callAiChat", "sendToChannel", "isNativeCinna", "readCinnaRuntime", "writeCinnaRuntime", "planCinnaReply", "fetch", output)(
    { env: { get: (name: string) => name === "SUPABASE_SERVICE_ROLE_KEY" ? "test-service" : "https://local.test" }, serve: (value: Handler) => { handler = value; } },
    z, () => ({ from }), {}, ai, send,
    isNativeCinna, readCinnaRuntime, writeCinnaRuntime, planCinnaReply, fetchMock);
  if (!handler) throw new Error("Missing handler");
  const invoke = (authorized = true, incoming = message) => handler!(new Request("https://local.test", { method: "POST",
    headers: authorized ? { Authorization: "Bearer test-service" } : {}, body: JSON.stringify({ session_id: "session", message: incoming }) }));
  return { invoke, execution, updates, send, fetchMock, event, ai };
}

describe("Cinna native runtime", () => {
  it("compiles edits, sequential edges and media without duplicating script text", () => {
    const value = actions(); value[0].template = "Edited introduction"; value[0].next_id = value[1].id;
    value.splice(1, 0, { id: "media", tipo: "audio", template: "", delay_min: 0, media: { id: "asset", label: "Audio", kind: "audio", url: "https://cdn.example.org/audio.mp3" } });
    value[0].next_id = "media";
    const compiled = compileNativeCinna(value);
    expect(compiled.config.stages[0].messages[0]).toBe("Edited introduction");
    expect(compiled.waitSteps[0]).toBe(createCinnaRuntime(actions()).snapshot.waitSteps[0] + 1);
  });
  it("rejects conflicting legacy text instead of executing stale content", () => {
    const value = actions(); Object.assign(value[0], { mensagem: "Stale text" });
    expect(() => compileNativeCinna(value)).toThrow("Conflicting");
  });
  it("keeps the execution snapshot pinned while new edits apply to new executions", () => {
    const value = actions(); const saved = writeCinnaRuntime([], createCinnaRuntime(value));
    value[0].template = "Later edit";
    expect(readCinnaRuntime(saved)?.snapshot.config.stages[0].messages[0]).not.toBe("Later edit");
    expect(createCinnaRuntime(value).snapshot.config.stages[0].messages[0]).toBe("Later edit");
  });
  it("advances native cursor but returns no next-stage messages to the adapter", async () => {
    const runtime = createCinnaRuntime(actions());
    const result = await planCinnaReply(runtime, runtime.snapshot.waitSteps[0], "event", "yes");
    expect(result.decision.action).toBe("advance"); expect(result.messages).toEqual([]);
    expect(result.resumeStep).toBe(runtime.snapshot.waitSteps[0] + 1);
  });
  it("refuses cursor mismatch and replay of pending delivery", async () => {
    const runtime = createCinnaRuntime(actions());
    await expect(planCinnaReply(runtime, 999, "event", "yes")).rejects.toThrow("cursor");
    const decision = (await planCinnaReply(runtime, runtime.snapshot.waitSteps[0], "event", "yes")).decision;
    runtime.pending = { eventId: "event", decision, messages: [], confirmed: 0, uncertain: true };
    expect(() => readCinnaRuntime(writeCinnaRuntime([], runtime))).toThrow("reconciliation");
  });
});
describe("Cinna real channel handler with mocked storage and sends", () => {
  it("requires service authorization without sends or mutations", async () => {
    const test = app("yes"); expect((await test.invoke(false)).status).toBe(401);
    expect(test.updates).toEqual([]); expect(test.send).not.toHaveBeenCalled();
  });
  it("requires an incoming persisted event matching the request", async () => {
    const test = app("yes"); expect((await test.invoke(true, "different")).status).toBe(500);
    expect(test.updates).toEqual([]); expect(test.send).not.toHaveBeenCalled();
  });
  it("resumes the same execution once without sending next-stage script twice", async () => {
    const test = app("yes"); const response = await test.invoke();
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ resumed: true });
    expect(test.send).not.toHaveBeenCalled(); expect(test.fetchMock).toHaveBeenCalledTimes(1);
  });
  it("serializes concurrent replies using the persisted JSON snapshot", async () => {
    const test = app("yes"); await Promise.all([test.invoke(), test.invoke()]);
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
  });
  it("holds medical questions and deduplicates the same persisted incoming event", async () => {
    const test = app("Can I take this with insulin?");
    expect((await test.invoke()).status).toBe(200); expect((await test.invoke()).status).toBe(200);
    expect(test.send).toHaveBeenCalledTimes(1); expect(test.fetchMock).not.toHaveBeenCalled();
    expect(test.execution.status).toBe("waiting");
  });
  it("persists stop and ignores later messages without resuming", async () => {
    const test = app("stop"); await test.invoke(); test.event.id = "later";
    await test.invoke(); expect(test.send).toHaveBeenCalledTimes(1); expect(test.fetchMock).not.toHaveBeenCalled();
    expect(readCinnaRuntime(test.execution.step_results)?.state.status).toBe("stopped");
  });
  it("keeps confirmed parts and blocks blind retries after partial delivery", async () => {
    const test = app("How much?", 2); expect((await test.invoke()).status).toBe(502);
    expect(test.send).toHaveBeenCalledTimes(2); expect(test.fetchMock).not.toHaveBeenCalled();
    expect(test.execution.status).toBe("running");
    expect(JSON.stringify(test.execution.step_results)).toContain('"confirmed":1');
    expect((await test.invoke()).status).toBe(500); expect(test.send).toHaveBeenCalledTimes(2);
  });
});

function executorApp(failSend = false, resumed = false) {
  const runtime = createCinnaRuntime(actions());
  const auto = { id: "flow", nome: "Cinna", ativo: true, project_id: "cinna-shield", canal: "webchat", acoes: actions(), trigger_tipo: "webchat_mensagem_recebida" };
  const session: Record<string, unknown> = { id: "session", project_id: "cinna-shield", canal: "webchat", external_id: "visitor", meta: {} };
  if (resumed) { runtime.state.stageIndex = 1; runtime.resumeToken = "resume-token"; }
  const execution: Record<string, unknown> = resumed ? { id: "execution", automacao_id: "flow", project_id: "cinna-shield", channel_session_id: "session",
    current_step: runtime.snapshot.waitSteps[0], status: "running", step_results: writeCinnaRuntime([], runtime) } : {};
  const inserts: string[] = [];
  const writes: Record<string, unknown>[] = [];
  function from(table: string) {
    const filters: [string, unknown][] = []; let patch: Record<string, unknown> | undefined; let inserting = false;
    const result = () => {
      const target = table === "imphq_flow_executions" ? execution : session;
      const matches = filters.every(([key, value]) => ["step_results", "meta"].includes(key) ? JSON.stringify(target[key]) === value : target[key] === value);
      if (table === "imphq_automacoes") return { data: [auto], error: null };
      if (table === "imphq_channel_sessions" || table === "imphq_flow_executions") {
        if (patch && (inserting || matches)) { if (inserting) inserts.push(table); writes.push(structuredClone(patch)); Object.assign(target, structuredClone(patch)); }
        return { data: inserting || matches ? structuredClone(target) : null, error: null };
      }
      return { data: [], error: null };
    };
    const chain = { select: (_value: string) => chain, in: (_key: string, _value: unknown) => chain,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; }, is: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
      order: (_key: string, _value: unknown) => chain, limit: (_value: number) => chain,
      insert: (value: Record<string, unknown>) => { patch = value; inserting = true; return chain; },
      update: (value: Record<string, unknown>) => { patch = value; return chain; },
      single: async () => result(), maybeSingle: async () => result(),
      then: (resolveResult: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolveResult),
    }; return chain;
  }
  let handler: Handler | undefined;
  const send = vi.fn(async () => ({ success: !failSend }));
  const source = readFileSync(resolve("supabase/functions/openflow-executor/index.ts"), "utf8").replace(/^import .*;\r?\n/gm, "");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function("Deno", "z", "createClient", "sendToChannel", "createCinnaRuntime", "readCinnaRuntime", "writeCinnaRuntime", "isNativeCinna", "setTimeout", output)(
    { env: { get: (name: string) => name === "SUPABASE_SERVICE_ROLE_KEY" ? "test-service" : "https://local.test" }, serve: (value: Handler) => { handler = value; } },
    z, () => ({ from }), send, createCinnaRuntime, readCinnaRuntime, writeCinnaRuntime, isNativeCinna, (callback: () => void) => callback());
  if (!handler) throw new Error("Missing executor handler");
  const invoke = (authorized = true) => handler!(new Request("https://local.test", { method: "POST", headers: authorized ? { Authorization: "Bearer test-service" } : {},
    body: JSON.stringify({ trigger_tipo: auto.trigger_tipo, project_id: auto.project_id, automacao_id: auto.id,
      ...(resumed ? { execution_id: "execution", resume_from_step: runtime.snapshot.waitSteps[0] + 1, cinna_resume_token: "resume-token" } : {}),
      lead_data: { channel_session_id: "session", canal: "webchat" } }) }));
  return { invoke, execution, send, inserts, writes, runtime };
}
describe("Cinna real native executor", () => {
  it("requires service authorization before mutation", async () => {
    const test = executorApp(); expect((await test.invoke(false)).status).toBe(401);
    expect(test.writes).toEqual([]); expect(test.send).not.toHaveBeenCalled();
  });
  it("sends the first stage and waits indefinitely with a pinned snapshot", async () => {
    const test = executorApp(); const response = await test.invoke();
    expect(response.status).toBe(200); expect(test.execution.status).toBe("waiting");
    expect(test.execution.next_run_at).toBeNull(); expect(test.execution.current_step).toBe(test.runtime.snapshot.waitSteps[0]);
    expect(readCinnaRuntime(test.execution.step_results)?.snapshot.config).toEqual(test.runtime.snapshot.config);
    expect(test.send).toHaveBeenCalledTimes(test.runtime.snapshot.config.stages[0].messages.length + 1);
  });
  it("resumes the same row through CAS and rejects a repeated token", async () => {
    const test = executorApp(false, true); expect((await test.invoke()).status).toBe(200);
    expect(test.inserts).toEqual([]); expect(test.execution.current_step).toBe(test.runtime.snapshot.waitSteps[1]);
    const sent = test.send.mock.calls.length; expect((await test.invoke()).status).toBe(500); expect(test.send).toHaveBeenCalledTimes(sent);
  });
  it("halts on failed delivery without reaching the wait or scheduling retry", async () => {
    const test = executorApp(true); await test.invoke();
    expect(test.send).toHaveBeenCalledTimes(1); expect(test.execution.status).toBe("running"); expect(test.execution.next_run_at).toBeNull();
    expect(test.execution.error_message).toContain("unconfirmed");
  });
});



describe("Ana contextual native channel handler", () => {
  it("composes a contextual hold once and does not regenerate a duplicate event", async () => {
    const test = app("I have diabetes and feel overwhelmed", -1, true);
    expect((await test.invoke()).status).toBe(200); expect((await test.invoke()).status).toBe(200);
    expect(test.ai.mock.calls.filter(([request]) => request.tag === "cinna-native-consultative")).toHaveLength(1);
    expect(test.send).toHaveBeenCalledTimes(1); expect(test.fetchMock).not.toHaveBeenCalled();
  });
  it("never invokes AI for a personal suitability request", async () => {
    const test = app("Can I take this with insulin?", -1, true);
    expect((await test.invoke()).status).toBe(200); expect(test.ai).not.toHaveBeenCalled();
    expect(readCinnaRuntime(test.execution.step_results)?.state.status).toBe("human");
    expect(test.fetchMock).not.toHaveBeenCalled();
  });
});

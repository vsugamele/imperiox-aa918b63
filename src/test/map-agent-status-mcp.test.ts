import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import * as maps from "@shared/project-map";
import * as capabilities from "@shared/capabilities";
import * as mapOrder from "@shared/map-order";
import * as playbooks from "@shared/playbooks";
import * as playbookApply from "@shared/playbook-apply";
import { checkMcpKey } from "@shared/mcp-auth";

type Handler = (req: Request) => Promise<Response>;
type Transport = "mcp" | "rest_post" | "rest_get";
interface Reading { pendingCount: number; totalSteps: number; steps: Array<maps.AgentStatusReading & { node_id: string; executor: string; skill: string; checklist: unknown[]; output_url: string | null; step_number?: number | null; print?: unknown }> }
const key = "imp_mcp_test_map_status_readonly";
const nodes = [
  { id: "full", notes: "", checklist: [{ text: "Feito", done: true }] },
  { id: "explicit", notes: "[agent_status:done]\n[agent_output:https://output.test/file]", checklist: [] },
  { id: "invalid", notes: "[agent_status:unexpected]", checklist: [{ text: "Feito", done: true }] },
  { id: "example", notes: "[agent_prompt_start]\n[agent_status:done]\n[agent_prompt_end]", checklist: [] },
// Posições da esquerda para a direita: o MCP devolve as etapas na ordem do fluxo (map-order).
].map((node, index) => ({ ...node, label: node.id, kind: "processo", executor_type: "AI_SKILL", linked_skill_id: "fixture-method", url: null, position: { x: index * 300, y: 0 } }));

function runtime() {
  let handler: Handler | undefined;
  const from = vi.fn((table: string) => {
    const records: unknown[] = table === "imphq_projects" ? [{ id: "p", name: "Fixture", data: {}, avatar: {} }]
      : table === "imphq_company_map_nodes" ? structuredClone(nodes) : [];
    const query = {
      select: () => query, eq: () => query, or: () => query, in: () => query,
      single: () => Promise.resolve({ data: records[0], error: null }),
      then: (resolve: (response: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: records, error: null }).then(resolve),
    };
    // No update/insert methods: the tested handlers must remain read-only.
    return query;
  });
  const source = readFileSync("supabase/functions/project-mcp/index.ts", "utf8").replace(/^import .*;\r?\n/gm, "");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const dependencies = { ...maps, ...capabilities, ...mapOrder, ...playbooks, ...playbookApply, checkMcpKey, createClient: () => ({ from }), Deno: { env: { get: (name: string) => name === "MCP_API_KEYS" ? key : "local-test-only" }, serve: (value: Handler) => { handler = value; } } };
  new Function(...Object.keys(dependencies), output)(...Object.values(dependencies));
  if (!handler) throw new Error("Missing handler");
  const invoke = (transport: Transport, status = "all", authorized = true) => {
    const args = { project_id: "p", status };
    const body = transport === "mcp" ? { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_executable_steps", arguments: args } } : { action: "executable_steps", ...args };
    return handler!(new Request(transport === "rest_get" ? "https://local.test/project-mcp?action=executable_steps&project_id=p" : "https://local.test/project-mcp", {
      method: transport === "rest_get" ? "GET" : "POST", headers: authorized ? { "x-mcp-key": key } : {},
      ...(transport === "rest_get" ? {} : { body: JSON.stringify(body) }),
    }));
  };
  const read = async (transport: Transport, status = "all"): Promise<Reading> => {
    const response = await invoke(transport, status);
    expect(response.status).toBe(200);
    if (transport !== "mcp") return response.json();
    const envelope: { result: { content: { text: string }[] } } = await response.json();
    return JSON.parse(envelope.result.content[0].text);
  };
  return { invoke, read, from };
}

describe("actual executable-step transports share declarative status", () => {
  it.each(["mcp", "rest_post", "rest_get"] as const)("rejects unauthenticated %s before data reads", async transport => {
    const app = runtime();
    expect((await app.invoke(transport, "all", false)).status).toBe(401);
    expect(app.from).not.toHaveBeenCalled();
  });
  it("preserves configuration and checklist while keeping all three read paths consistent", async () => {
    const app = runtime();
    const readings = await Promise.all((["mcp", "rest_post", "rest_get"] as const).map(transport => app.read(transport)));
    for (const reading of readings) {
      expect(reading).toMatchObject({ pendingCount: 3, totalSteps: 4 });
      expect(reading.steps.map(step => [step.node_id, step.status, step.status_source])).toEqual([
        ["full", "pending", "not_declared"], ["explicit", "done", "notes"], ["invalid", "pending", "not_declared"], ["example", "pending", "not_declared"],
      ]);
      expect(reading.steps.every(step => step.operationalEvidence === "unverified" && step.executor === "AI_SKILL" && step.skill === "fixture-method")).toBe(true);
      expect(reading.steps[0].checklist).toEqual(nodes[0].checklist);
      expect(reading.steps[1].output_url).toBe("https://output.test/file");
    }
  });
  it("numbers the MCP steps in flow order and returns the page print slot", async () => {
    const reading = await runtime().read("mcp");
    expect(reading.steps.map(step => [step.node_id, step.step_number])).toEqual([["full", 1], ["explicit", 2], ["invalid", 3], ["example", 4]]);
    expect(reading.steps.every(step => step.print === null)).toBe(true);
  });
  it.each(["mcp", "rest_post"] as const)("keeps untagged full checklists in the pending filter of %s", async transport => {
    const app = runtime();
    expect((await app.read(transport, "pending")).steps.map(step => step.node_id)).toEqual(["full", "invalid", "example"]);
    expect((await app.read(transport, "done")).steps.map(step => step.node_id)).toEqual(["explicit"]);
  });
});

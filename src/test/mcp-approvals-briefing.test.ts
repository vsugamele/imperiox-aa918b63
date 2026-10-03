import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as maps from "@shared/project-map";
import * as capabilities from "@shared/capabilities";
import * as mapOrder from "@shared/map-order";
import * as playbooks from "@shared/playbooks";
import * as playbookApply from "@shared/playbook-apply";
import * as mapSteps from "@shared/map-steps";
import * as approvalQueue from "@shared/approval-queue";
import * as projectBriefing from "@shared/project-briefing";
import * as todayBoard from "@shared/today-board";
import * as scaleLadder from "@shared/scale-ladder";
import { checkMcpKey } from "@shared/mcp-auth";

type Handler = (req: Request) => Promise<Response>;
type Row = Record<string, unknown>;
const key = "imp_mcp_test_approvals_briefing";
const hourAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

function fixtures(): Record<string, Row[]> {
  return {
    imphq_projects: [{ id: "p", name: "Projeto P" }],
    imphq_company_maps: [],
    imphq_team_members: [{ id: "m1", name: "Bruno Lima", email: "b@test", user_id: null }],
    imphq_company_map_nodes: [
      { id: "rev", map_id: "map", label: "Revisar VSL", kind: "vsl", notes: "[agent_status:ready_review]", step_status: "ready_review", checklist: [], position: { x: 0, y: 0 }, linked_project_id: "p", owner_member_id: "m1", due_date: "2000-01-01", status_changed_at: hourAgo(5) },
      { id: "todo", map_id: "map", label: "Gravar anúncio", kind: "anuncio", notes: "", step_status: "pending", checklist: [], position: { x: 300, y: 0 }, linked_project_id: "p", executor_type: "HUMAN" },
    ],
    imphq_ai_actions: [{ id: "a1", kind: "pause_ad", title: "Pausar anúncio caro", reason: "CPA alto", risk_level: "high", impact_brl: 120, projeto_id: "p", created_at: hourAgo(3), status: "proposed" }],
    imphq_content_items: [{ id: "c1", project_id: "p", title: "Reels 1", hook: "Gancho", status: "pronto", created_at: hourAgo(2) }],
    imphq_v_ai_drafts: [{ id: "d1", project_id: "p", contact_name: "Ana", suggested_text: "Oi Ana", created_at: hourAgo(1), status: "pending" }],
    imphq_vendas: [{ project_id: "p", valor: 47, data: {}, status: "aprovado" }],
    imphq_leads: [{ project_id: "p" }],
    imphq_scale_rounds: [
      { id: "r2", project_id: "p", fase: "p1", rodada: "S42", updated_at: "2026-10-02", resultado: { placar_hipoteses: [{ hipotese: "Dor à tarde", concept: "A", resultado: "refutada" }] } },
      { id: "r1", project_id: "p", fase: "p1", rodada: "S41", updated_at: "2026-09-25", resultado: { placar_hipoteses: [{ hipotese: "dor à tarde", concept: "A", resultado: "confirmada" }, { hipotese: "Meia falhou", concept: "B", resultado: "parcial" }] } },
      { id: "r3", project_id: "p", fase: "p3", rodada: "S42", updated_at: "2026-10-02", resultado: null },
    ],
  };
}

function runtime() {
  let handler: Handler | undefined;
  const db = fixtures();
  const updates: Array<{ table: string; values: Row; id: unknown }> = [];
  const from = (table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let patch: Row | null = null;
    const rows = () => (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const query = {
      select: () => query, order: () => query, limit: () => query, or: () => query, in: () => query, not: () => query, gte: () => query, lt: () => query,
      eq: (col: string, val: unknown) => {
        if (patch) { updates.push({ table, values: patch, id: val }); const target = db[table]?.find((r) => r[col] === val); if (target) Object.assign(target, patch); return Promise.resolve({ error: null }); }
        filters.push((r) => !(col in r) || r[col] === val); return query;
      },
      neq: (col: string, val: unknown) => { filters.push((r) => r[col] !== val); return query; },
      update: (values: Row) => { patch = values; return query; },
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (r: { data: Row[]; count: number; error: null }) => unknown) => Promise.resolve({ data: rows(), count: rows().length, error: null }).then(resolve),
    };
    return query;
  };
  const source = readFileSync("supabase/functions/project-mcp/index.ts", "utf8").replace(/^import .*;\r?\n/gm, "");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const dependencies = { ...maps, ...capabilities, ...mapOrder, ...playbooks, ...playbookApply, ...mapSteps, ...approvalQueue, ...projectBriefing, ...todayBoard, ...scaleLadder, checkMcpKey, createClient: () => ({ from }), Deno: { env: { get: (name: string) => name === "MCP_API_KEYS" ? key : "local-test-only" }, serve: (value: Handler) => { handler = value; } } };
  new Function(...Object.keys(dependencies), output)(...Object.values(dependencies));
  const call = async (name: string, args: Row) => {
    const response = await handler!(new Request("https://local.test/project-mcp", {
      method: "POST", headers: { "x-mcp-key": key },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    }));
    const envelope: { result?: { content: { text: string }[] }; error?: { message: string } } = await response.json();
    if (envelope.error) throw new Error(envelope.error.message);
    return JSON.parse(envelope.result!.content[0].text);
  };
  return { call, updates, db };
}

describe("project-mcp approvals and briefing", () => {
  it("lists the same queue as /aprovar, most urgent first, with what the MCP may decide", async () => {
    const res = await runtime().call("get_approvals", { project_id: "p" });
    expect(res.total).toBe(4);
    expect(res.itens.map((i: { key: string }) => i.key)).toEqual(["rascunho:d1", "etapa:rev", "acao_ia:a1", "conteudo:c1"]);
    expect(res.itens.map((i: { decisao_pelo_mcp: string[] }) => i.decisao_pelo_mcp)).toEqual([[], ["approve", "reject"], ["reject"], ["approve", "reject"]]);
  });

  it("approves a step in review and records the reason in the notes", async () => {
    const app = runtime();
    const res = await app.call("decide_approval", { key: "etapa:rev", decision: "approve", motivo: "VSL ok" });
    expect(res.resultado).toBe("Etapa marcada como feita");
    expect(app.updates[0].values).toMatchObject({ step_status: "done", status_changed_by: "mcp" });
    expect(String(app.updates[0].values.notes)).toContain("[agent_status:done]");
    expect(String(app.updates[0].values.notes)).toContain("VSL ok");
  });

  it("never executes an AI action nor answers a customer through the MCP", async () => {
    const app = runtime();
    await expect(app.call("decide_approval", { key: "acao_ia:a1", decision: "approve" })).rejects.toThrow(/tela \/aprovar/);
    await expect(app.call("decide_approval", { key: "rascunho:d1", decision: "approve" })).rejects.toThrow(/rascunhos/);
    expect(app.updates).toHaveLength(0);
    const res = await app.call("decide_approval", { key: "acao_ia:a1", decision: "reject" });
    expect(res.resultado).toBe("Ação da IA reprovada");
    expect(app.updates[0]).toMatchObject({ table: "imphq_ai_actions", values: { status: "rejected" } });
  });

  it("refuses to decide an item that is no longer waiting", async () => {
    const app = runtime();
    await app.call("decide_approval", { key: "conteudo:c1", decision: "approve" });
    await expect(app.call("decide_approval", { key: "conteudo:c1", decision: "reject" })).rejects.toThrow(/não está esperando/);
  });

  it("returns the project briefing in one call", async () => {
    const res = await runtime().call("get_briefing", { project_id: "p" });
    expect(res.projeto).toEqual({ id: "p", name: "Projeto P" });
    expect(res.hoje).toMatchObject({ vendas: 1, faturamento: { BRL: 47 }, leads_novos: 1 });
    expect(res.etapas.para_revisar[0]).toMatchObject({ etapa: "Revisar VSL", responsavel: "Bruno Lima", situacao_prazo: "Atrasada" });
    expect(res.etapas.atrasadas).toBe(1);
    expect(res.etapas.esperando_o_time[0].etapa).toBe("Gravar anúncio");
    expect(res.aprovacoes.total).toBe(4);
  });

  it("returns saved scale rounds and the accumulated hypothesis board, latest result first", async () => {
    const all = await runtime().call("get_scale_rounds", { project_id: "p" });
    expect(all.rodadas).toHaveLength(3);
    expect(all.placar_hipoteses).toEqual([
      expect.objectContaining({ hipotese: "Dor à tarde", resultado: "refutada", rodada: "S42" }),
      expect.objectContaining({ hipotese: "Meia falhou", resultado: "parcial", rodada: "S41" }),
    ]);
    const p3 = await runtime().call("get_scale_rounds", { project_id: "p", fase: "p3" });
    expect(p3.rodadas.map((r: { id: string }) => r.id)).toEqual(["r3"]);
  });

  it("evaluates the scale ladder without touching the database", async () => {
    const app = runtime();
    const res = await app.call("evaluate_scale", { fase: "p1", payout: 70, cpa_alvo: 45, concepts: [{ concept: "A", hipotese: "H", gasto: 80, ic: 15, vendas: 0 }] });
    expect(res).toMatchObject({ fase: "p1", qualificados: 1, placar_hipoteses: [{ resultado: "confirmada" }] });
    expect(app.updates).toHaveLength(0);
  });
});

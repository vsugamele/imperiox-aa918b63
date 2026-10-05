import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import * as launchKit from "@shared/launch-kit";
import * as launchPlan from "@shared/launch-plan";
import * as approvalRows from "@shared/approval-rows";
import * as autonomy from "@shared/autonomy";
import { DECISIONS_BY_SOURCE, decideApproval as applyDecision } from "@shared/approval-decide";
import * as testOrder from "@shared/test-order";
import { adsSyncHealth } from "@shared/live-panel";
import { PLAYBOOK_LIBRARY } from "@shared/playbook-library";
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
    imphq_playbook_applications: [{ project_id: "p", playbook_id: "x1-conversa" }],
    imphq_project_access: [{ project_id: "p", access_key: "checkout", status: "conectado", nota: null, owner_member_id: null }],
    imphq_wa_providers: [{ id: "w1", project_id: "p", is_active: true }],
    imphq_playbooks: PLAYBOOK_LIBRARY.map(({ steps: _steps, ...p }) => ({ ...p, ativo: true })),
    imphq_playbook_steps: PLAYBOOK_LIBRARY.flatMap((p) => p.steps.map((st) => ({ ...st, playbook_id: p.id }))),
    imphq_test_orders: [{
      id: "t1", project_id: "p", nome: "Teste P", oferta: "Curso", tipo_pagina: "pagina_vendas", pagina_url: "https://p.test/", ad_account_id: "1", page_id: "2", pixel_id: "3",
      verba_dia_conjunto: 30, payout: 47, cpa_alvo: 40, ics_por_venda: 8, utm_campaign: "teste-p", status: "no_ar", meta_campaign_id: "c1",
      ativado_em: hourAgo(72), corte_autorizado_por: "Bruno Lima", corte_ate: "2999-01-01", scale_round_id: null,
    }],
    imphq_test_variants: [
      { id: "tv1", order_id: "t1", ordem: 1, angulo: "Medo", hipotese: "Medo trava", utm_content: "01-medo", meta_adset_id: "as1", status: "no_ar" },
      { id: "tv2", order_id: "t1", ordem: 2, angulo: "Dinheiro", hipotese: "Dinheiro move", utm_content: "02-dinheiro", meta_adset_id: "as2", status: "no_ar" },
    ],
    imphq_scale_rounds: [
      { id: "r2", project_id: "p", fase: "p1", rodada: "S42", updated_at: "2026-10-02", resultado: { placar_hipoteses: [{ hipotese: "Dor à tarde", concept: "A", resultado: "refutada" }] } },
      { id: "r1", project_id: "p", fase: "p1", rodada: "S41", updated_at: "2026-09-25", resultado: { placar_hipoteses: [{ hipotese: "dor à tarde", concept: "A", resultado: "confirmada" }, { hipotese: "Meia falhou", concept: "B", resultado: "parcial" }] } },
      { id: "r3", project_id: "p", fase: "p3", rodada: "S42", updated_at: "2026-10-02", resultado: null },
    ],
  };
}

function runtime(opts: { failInsertOn?: string } = {}) {
  let handler: Handler | undefined;
  const db = fixtures();
  const updates: Array<{ table: string; values: Row; id: unknown }> = [];
  const inserts: Array<{ table: string; values: Row }> = [];
  const deletes: Array<{ table: string; col: string; val: unknown }> = [];
  let seq = 0;
  const actors: string[] = [];
  const from = (table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let patch: Row | null = null;
    const rows = () => (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const query = {
      select: () => query, order: () => query, limit: () => query, or: () => query, not: () => query, gte: () => query, lt: () => query,
      in: (col: string, vals: unknown[]) => { filters.push((r) => !(col in r) || vals.includes(r[col])); return query; },
      eq: (col: string, val: unknown) => {
        if (patch) { updates.push({ table, values: patch, id: val }); const target = db[table]?.find((r) => r[col] === val); if (target) Object.assign(target, patch); return Promise.resolve({ error: null }); }
        filters.push((r) => !(col in r) || r[col] === val); return query;
      },
      neq: (col: string, val: unknown) => { filters.push((r) => r[col] !== val); return query; },
      update: (values: Row) => { patch = values; return query; },
      upsert: (values: Row) => { updates.push({ table, values, id: null }); return Promise.resolve({ error: null }); },
      insert: (values: Row) => {
        const error = opts.failInsertOn === table ? { message: `falha em ${table}` } : null;
        if (!error) inserts.push({ table, values });
        const done = Promise.resolve({ error });
        return { select: () => ({ single: () => Promise.resolve({ data: error ? null : { id: `new-${++seq}` }, error }) }), then: done.then.bind(done) };
      },
      delete: () => ({ eq: (col: string, val: unknown) => { deletes.push({ table, col, val }); return Promise.resolve({ error: null }); } }),
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (r: { data: Row[]; count: number; error: null }) => unknown) => Promise.resolve({ data: rows(), count: rows().length, error: null }).then(resolve),
    };
    return query;
  };
  const source = readFileSync("supabase/functions/project-mcp/index.ts", "utf8").replace(/^import .*;\r?\n/gm, "");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const dependencies = { ...maps, ...capabilities, ...mapOrder, ...playbooks, ...playbookApply, ...mapSteps, ...approvalQueue, ...projectBriefing, ...todayBoard, ...scaleLadder, ...launchKit, ...launchPlan, ...approvalRows, ...autonomy, ...testOrder, DECISIONS_BY_SOURCE, applyDecision, adsSyncHealth, checkMcpKey,
    createClient: (_url: string, _key: string, options?: { global?: { headers?: Record<string, string> } }) => {
      const actor = options?.global?.headers?.["x-imperio-actor"];
      if (actor) actors.push(actor);
      return { from };
    }, Deno: { env: { get: (name: string) => name === "MCP_API_KEYS" ? key : "local-test-only" }, serve: (value: Handler) => { handler = value; } } };
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
  return { call, updates, db, inserts, deletes, actors };
}

describe("project-mcp approvals and briefing", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("lists the same queue as /aprovar, most urgent first, with what the MCP may decide and what needs an OK", async () => {
    const res = await runtime().call("get_approvals", { project_id: "p" });
    expect(res.total).toBe(4);
    expect(res.itens.map((i: { key: string }) => i.key)).toEqual(["rascunho:d1", "etapa:rev", "acao_ia:a1", "conteudo:c1"]);
    expect(res.itens.map((i: { decisao_pelo_mcp: string[] }) => i.decisao_pelo_mcp)).toEqual([[], ["approve", "reject"], ["approve", "reject"], ["approve", "reject"]]);
    expect(res.itens.map((i: { precisa_ok_de_alguem: string[] }) => i.precisa_ok_de_alguem)).toEqual([[], ["approve"], ["approve"], ["approve"]]);
  });

  it("approves a step in review only with someone's OK, recording the reason and who decided", async () => {
    const app = runtime();
    await expect(app.call("decide_approval", { key: "etapa:rev", decision: "approve" })).rejects.toThrow(/confirmado_por/);
    await expect(app.call("decide_approval", { key: "etapa:rev", decision: "approve", confirmado_por: "fulano" })).rejects.toThrow(/confirmado_por/);
    expect(app.updates).toHaveLength(0);
    const res = await app.call("decide_approval", { key: "etapa:rev", decision: "approve", motivo: "VSL ok", confirmado_por: "bruno" });
    expect(res).toMatchObject({ resultado: "Etapa marcada como feita", quem: "ia (OK de Bruno Lima) via mcp" });
    expect(app.updates[0].values).toMatchObject({ step_status: "done", status_changed_by: "ia (OK de Bruno Lima) via mcp" });
    expect(String(app.updates[0].values.notes)).toContain("[agent_status:done]");
    expect(String(app.updates[0].values.notes)).toContain("VSL ok");
    expect(app.actors).toContain("ia (OK de Bruno Lima) via mcp");
  });

  it("executes an AI action only with an OK, rejects alone, and never answers a customer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const app = runtime();
    await expect(app.call("decide_approval", { key: "acao_ia:a1", decision: "approve" })).rejects.toThrow(/OK de alguém do time/);
    await expect(app.call("decide_approval", { key: "rascunho:d1", decision: "approve" })).rejects.toThrow(/rascunhos/);
    expect(fetchMock).not.toHaveBeenCalled();
    const done = await app.call("decide_approval", { key: "acao_ia:a1", decision: "approve", confirmado_por: "b@test" });
    expect(done.resultado).toBe("Ação executada");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/functions/v1/imperius-executor"), expect.objectContaining({ method: "POST" }));

    const other = runtime();
    const res = await other.call("decide_approval", { key: "acao_ia:a1", decision: "reject" });
    expect(res).toMatchObject({ resultado: "Ação rejeitada", quem: "ia (mcp)" });
    expect(other.updates[0]).toMatchObject({ table: "imphq_ai_actions", values: { status: "rejected" } });
  });

  it("never registers a pix recovery as sent through the MCP", async () => {
    const app = runtime();
    await expect(app.call("decide_approval", { key: "pix_travado:v9", decision: "approve", confirmado_por: "bruno" })).rejects.toThrow(/nunca/);
  });

  it("refuses to decide an item that is no longer waiting", async () => {
    const app = runtime();
    await app.call("decide_approval", { key: "conteudo:c1", decision: "approve", confirmado_por: "bruno" });
    await expect(app.call("decide_approval", { key: "conteudo:c1", decision: "reject" })).rejects.toThrow(/não está esperando/);
  });

  it("lists the autonomy levels with the ceiling of each action", async () => {
    const res = await runtime().call("get_autonomy", {});
    const pix = res.acoes.find((a: { acao: string }) => a.acao === "pix_travado:approve");
    expect(pix).toMatchObject({ nivel: "nunca", teto: "nunca" });
    expect(res.acoes.find((a: { acao: string }) => a.acao === "step:assign")).toMatchObject({ nivel: "auto" });
  });

  it("returns the project briefing in one call", async () => {
    const res = await runtime().call("get_briefing", { project_id: "p" });
    expect(res.projeto).toEqual({ id: "p", name: "Projeto P" });
    expect(res.hoje).toMatchObject({ vendas: 1, faturamento: { BRL: 47 }, leads_novos: 1 });
    expect(res.etapas.para_revisar[0]).toMatchObject({ etapa: "Revisar VSL", responsavel: "Bruno Lima", situacao_prazo: "Atrasada" });
    expect(res.etapas.atrasadas).toBe(1);
    expect(res.etapas.esperando_o_time[0].etapa).toBe("Gravar anúncio");
    expect(res.aprovacoes.total).toBe(4);
    expect(res.alertas[0]).toMatchObject({ nivel: "critico" });
    expect(res.diario).toEqual([]);
  });

  it("plans a test order without writing, then saves it with variants", async () => {
    const args = {
      project_id: "p", nome: "Novo teste", oferta: "Curso R$ 47", pagina_url: "https://p.test/vendas", ad_account_id: "act_1", page_id: "2", pixel_id: "3",
      verba_dia_conjunto: 30, payout: 47, cpa_alvo: 40,
      variantes: [{ angulo: "Medo", hipotese: "H1", image_url: "https://x/1.jpg", texto: "T1" }, { angulo: "Status", hipotese: "H2", image_url: "https://x/2.jpg", texto: "T2" }],
    };
    const app = runtime();
    const plan = await app.call("create_test_order", args);
    expect(plan.modo).toBe("plano (nada foi gravado)");
    expect(plan.plano.verba_dia_total).toBe(60);
    expect(app.inserts).toHaveLength(0);
    const saved = await app.call("create_test_order", { ...args, confirmar: true });
    expect(saved).toMatchObject({ success: true });
    expect(app.inserts.map((i) => i.table)).toEqual(["imphq_test_orders", "imphq_test_variants"]);
    expect(app.inserts[0].values).toMatchObject({ ad_account_id: "1", verba_dia_conjunto: 30, status: "pronto", utm_campaign: expect.stringMatching(/^novo-teste-/) });
  });

  it("evaluates a live test by the scale ladder, saves the P1 round and applies authorized cuts", async () => {
    const app = runtime();
    const res = await app.call("evaluate_test_order", { id: "t1", leituras: [{ adset_id: "as1", gasto: 60, ic: 0, vendas: 0 }, { ordem: 2, gasto: 60, ic: 15, vendas: 1 }], aplicar_pausas: true });
    expect(res.pausar).toEqual([1]);
    expect(res.vencedores).toEqual([2]);
    expect(res.corte).toMatchObject({ aplicado: true, pausar_na_meta: [{ ordem: 1, angulo: "Medo", adset_id: "as1" }] });
    expect(app.updates.find((u) => u.table === "imphq_test_variants" && u.id === "tv1")?.values).toMatchObject({ status: "morto" });
    expect(app.inserts.find((i) => i.table === "imphq_scale_rounds")?.values).toMatchObject({ project_id: "p", fase: "p1" });
    expect(app.actors).toContain("ia (corte autorizado por Bruno Lima) via mcp");
  });

  it("orders creative variations from a test variant through the factory, on behalf of a team member", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, batch_id: "b1", quantidade: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const app = runtime();
    app.db.imphq_test_variants[0] = { ...app.db.imphq_test_variants[0], image_url: "https://x/medo.jpg", texto: "Medo?" };
    app.db.imphq_team_members[0] = { ...app.db.imphq_team_members[0], user_id: "u1" };
    const res = await app.call("generate_creative_variations", { project_id: "p", test_order_id: "t1", ordem: 1, quantidade: 2 });
    expect(res).toMatchObject({ success: true, batch_id: "b1", angulo: "Medo", pedido_por: "Bruno Lima" });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ action: "variations", user_id: "u1", base_image_url: "https://x/medo.jpg", oferta: "Curso", texto_base: "Medo?" });
  });

  it("only turns a test on with someone's OK", async () => {
    await expect(runtime().call("record_test_launch", { id: "t1", ativado: true })).rejects.toThrow(/confirmado_por/);
    const res = await runtime().call("record_test_launch", { id: "t1", ativado: true, confirmado_por: "bruno", campaign_id: "c9", variantes: [{ ordem: 1, adset_id: "as9", ad_id: "ad9" }] });
    expect(res).toMatchObject({ success: true, status: "no_ar", variantes_atualizadas: 1 });
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

  it("reads the project kit from applied playbooks, declared access and evidence", async () => {
    const kit = await runtime().call("get_project_kit", { project_id: "p" });
    expect(kit.canais).toEqual(["x1"]);
    expect(kit.itens.filter((i: { obrigatorio: boolean }) => i.obrigatorio).map((i: { key: string; status: string }) => [i.key, i.status])).toEqual([["checkout", "conectado"]]);
    expect(kit.grupos[0]).toMatchObject({ membros: ["whatsapp", "instagram_dm"], satisfeito: true });
    expect(kit.pronto_para_rodar).toBe(true);
    const asked = await runtime().call("get_project_kit", { project_id: "p", canais: "youtube, podcast" });
    expect(asked).toMatchObject({ canais: ["youtube"], canais_invalidos: ["podcast"], progresso: "0/2" });
  });

  it("marks an access status with owner and rejects unknown keys", async () => {
    const app = runtime();
    const res = await app.call("set_project_access", { project_id: "p", acesso: "dominio", status: "em_andamento", responsavel: "bruno" });
    expect(res).toMatchObject({ success: true, status: "Em andamento" });
    expect(app.updates[0]).toMatchObject({ table: "imphq_project_access", values: { access_key: "dominio", status: "em_andamento", owner_member_id: "m1" } });
    await expect(app.call("set_project_access", { project_id: "p", acesso: "senha_banco", status: "conectado" })).rejects.toThrow(/desconhecido/);
  });

  it("plans a launch without writing, then creates it", async () => {
    const plan = await runtime().call("launch_project", { nome: "Crypto Signals", canais: "youtube" });
    expect(plan).toMatchObject({ modo: "plano (nada foi gravado)", projeto: { id: "crypto_signals", mercado: "EUA (EN)" }, playbooks: [{ id: "youtube-canal", novas: 12 }] });
    const app = runtime();
    const done = await app.call("launch_project", { nome: "Crypto Signals", canais: "youtube", confirmar: true });
    expect(done.success).toBe(true);
    expect(app.inserts.map((i) => i.table).slice(0, 3)).toEqual(["imphq_projects", "imphq_company_maps", "imphq_company_map_nodes"]);
    expect(app.inserts.filter((i) => i.table === "imphq_company_map_nodes")).toHaveLength(13);
    expect(app.updates.filter((u) => u.table === "imphq_project_access").map((u) => u.values.access_key)).toEqual(["google_conta", "youtube_canal"]);
    await expect(runtime().call("launch_project", { nome: "Projeto P", canais: "x1", id: "p" })).rejects.toThrow(/Já existe/);
  });

  it("undoes a launch that fails halfway", async () => {
    const app = runtime({ failInsertOn: "imphq_company_map_edges" });
    await expect(app.call("launch_project", { nome: "Crypto Signals", canais: "youtube", confirmar: true })).rejects.toThrow(/desfeito/);
    expect(app.deletes.map((d) => d.table)).toEqual(["imphq_playbook_applications", "imphq_project_access", "imphq_company_maps", "imphq_projects"]);
    expect(app.deletes.at(-1)).toMatchObject({ col: "id", val: "crypto_signals" });
  });

  it("evaluates the scale ladder without touching the database", async () => {
    const app = runtime();
    const res = await app.call("evaluate_scale", { fase: "p1", payout: 70, cpa_alvo: 45, concepts: [{ concept: "A", hipotese: "H", gasto: 80, ic: 15, vendas: 0 }] });
    expect(res).toMatchObject({ fase: "p1", qualificados: 1, placar_hipoteses: [{ resultado: "confirmada" }] });
    expect(app.updates).toHaveLength(0);
  });
});

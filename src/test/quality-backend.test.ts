import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Handler = (request: Request) => Promise<Response>;
function loadEmbedder(authorized: boolean, provider = false) {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/wa-doc-embedder/index.ts"), "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
  let handler: Handler | undefined;
  const createClient = vi.fn(() => ({}));
  const requireUser = vi.fn(async () => authorized ? { ok: true } : { ok: false, response: new Response("Unauthorized", { status: 401 }) });
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ embedding: Array(768).fill(0.1) }] }), { status: 200 }));
  const run = new Function("serve", "createClient", "requireUser", "Deno", "fetch", compiled.outputText);
  run((value: Handler) => { handler = value; }, createClient, requireUser, { env: { get: (name: string) => provider && name === "LOVABLE_API_KEY" ? "test-provider" : undefined } }, fetchMock);
  if (!handler) throw new Error("Handler not registered");
  return { handler, createClient, requireUser, fetchMock };
}
const request = (body: unknown) => new Request("https://local.test", { method: "POST", body: JSON.stringify(body) });
describe("document embedder request boundary", () => {
  it("allows CORS without authenticating or creating a database client", async () => {
    const app = loadEmbedder(false);
    const response = await app.handler(new Request("https://local.test", { method: "OPTIONS" }));
    expect(response.status).toBe(200);
    expect(app.requireUser).not.toHaveBeenCalled();
    expect(app.createClient).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated real requests before database access", async () => {
    const app = loadEmbedder(false);
    expect((await app.handler(request({ action: "get_embedding", text: "hello" }))).status).toBe(401);
    expect(app.createClient).not.toHaveBeenCalled();
    expect(app.fetchMock).not.toHaveBeenCalled();
  });
  it.each([null, [], "invalid", { action: "get_embedding", text: 4 }])("rejects malformed input %j before provider access", async (body) => {
    const app = loadEmbedder(true);
    expect((await app.handler(request(body))).status).toBe(400);
    expect(app.fetchMock).not.toHaveBeenCalled();
  });
  it("returns the validated embedding for an authorized query", async () => {
    const app = loadEmbedder(true, true);
    const response = await app.handler(request({ action: "get_embedding", text: "hello" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, embedding: Array(768).fill(0.1) });
  });
  it("rejects vectors with wrong dimensions", async () => {
    const app = loadEmbedder(true, true);
    app.fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [{ embedding: [1, 2] }] })));
    expect((await app.handler(request({ action: "get_embedding", text: "hello" }))).status).toBe(500);
  });
});

function loadOpenflowContracts() {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/openflow-ai/index.ts"), "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
  const run = new Function("serve", "z", `${compiled.outputText}\nreturn { requestSchema, nodeSchema, emailSchema, generatedAngleSchema };`);
  return run(() => undefined, z) as { requestSchema: z.ZodType<Record<string, unknown>>; nodeSchema: z.ZodType; emailSchema: z.ZodType; generatedAngleSchema: z.ZodType };
}
import { z } from "zod";
describe("Openflow typed input and generated output contracts", () => {
  const contracts = loadOpenflowContracts();
  it.each(["generate_flowchart", "generate_image", "edit_image", "generate_brainstorm", "market_intel_research", "execute_skill", "generate_campaign_drafts", "analyze_ads_performance", "generate_campaign_message", "refine_skill", "analyze_lead", "generate_funnel_pipeline"])("preserves optional defaults for %s", (action) => {
    expect(contracts.requestSchema.parse({action})).toEqual({action});
  });
  it("keeps extension fields and optional nullable lead fields", () => {
    const body = {action:"analyze_lead", custom_extension:{x:1}, lead:{nome:null,tags:null,data:null,total_gasto:null}, form_responses:[{question:"Preference",answer:["one"]}]};
    const parsed = contracts.requestSchema.parse(body);
    expect(parsed.custom_extension).toEqual({x:1});
    expect(parsed.form_responses).toEqual(body.form_responses);
  });
  it.each([{num_nodes:"eight"},{extra:{existing_etapas:[4]}},{form_responses:[{question:4}]},{skill_slugs:"one"},{briefing:{ativos:"site"}}])("rejects unsafe route field %j", body => {
    expect(contracts.requestSchema.safeParse(body).success).toBe(false);
  });
  it("rejects fractional flow connections and malformed generated content", () => {
    expect(contracts.nodeSchema.safeParse({connects_to:[1.5]}).success).toBe(false);
    expect(contracts.emailSchema.safeParse({numero:1,assunto:"subject"}).success).toBe(false);
    expect(contracts.generatedAngleSchema.safeParse({slug:"hook",headline:42}).success).toBe(false);
  });
});

it("preserves imported product fields and nullable optional media", () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/funnel-import-product/index.ts"), "utf8");
  const parserSource = source.slice(source.indexOf("interface ImportedProduct"), source.indexOf("const corsHeaders"));
  const compiled = ts.transpileModule(parserSource, { compilerOptions: {target:ts.ScriptTarget.ES2022} });
  const parse = new Function(`${compiled.outputText}; return parseImportedProduct;`)() as (s:string)=>Record<string,unknown>;
  expect(parse('{"nome":"Product","imagem":null,"custom":{"kept":true}}')).toEqual({nome:"Product",imagem:null,custom:{kept:true}});
  expect(() => parse('[]')).toThrow();
  expect(() => parse('{"nome":45}')).toThrow();
});

it("validates timeline dates before creating rows while preserving defaults", () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/launch-timeline-generate/index.ts"), "utf8");
  const snippet = source.slice(source.indexOf("    const parsed: unknown"), source.indexOf("    if (rows.length)"));
  const compiled = ts.transpileModule(snippet, {compilerOptions:{target:ts.ScriptTarget.ES2022}});
  const build = new Function("content","project_id","funil_id","modelo",`${compiled.outputText};return rows;`) as (s:string,p:string,f:null,m:string)=>Array<Record<string,unknown>>;
  const rows=build(JSON.stringify({items:[{scheduled_at:"2026-09-09T12:00:00Z"}]}),"project",null,"vsl");
  expect(rows[0]).toMatchObject({title:"Item",peca_tipo:"evento",duration_min:60,scheduled_at:"2026-09-09T12:00:00.000Z"});
  expect(()=>build('{"items":[{"scheduled_at":{}}]}',"project",null,"vsl")).toThrow("Invalid timeline date");
  expect(()=>build('{"items":3}',"project",null,"vsl")).toThrow("Invalid timeline items");
});

it.each([null, [], "bad", {entity_id:22}])("rejects invalid ads action input before reading credentials: %j", async body => {
  const source=readFileSync(resolve(process.cwd(),"supabase/functions/zernio-ads-toggle/index.ts"),"utf8").replace(/^import .*;\r?\n/gm,"");
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}});
  let handler:Handler|undefined;
  const createClient=vi.fn();
  new Function("Deno","createClient",compiled.outputText)({serve:(h:Handler)=>{handler=h;}},createClient);
  if(!handler) throw new Error("Handler not registered");
  expect((await handler(request(body))).status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
});

it("keeps valid flow runtime events and skips malformed entries without counters", async () => {
  const source=readFileSync(resolve(process.cwd(),"supabase/functions/flow-runtime/index.ts"),"utf8").replace(/^import .*;\r?\n/gm,"");
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}});
  let handler:Handler|undefined;
  const insert=vi.fn(async()=>({error:null}));
  const rpc=vi.fn(async()=>({error:null}));
  const database={from:()=>({insert}),rpc};
  new Function("Deno","createClient","corsHeaders",compiled.outputText)({env:{get:()=>"test"},serve:(h:Handler)=>{handler=h;}},()=>database,{});
  if(!handler) throw new Error("Handler not registered");
  const response=await handler(request({events:[{blueprint_id:"bp",node_id:"node",event_type:"entered",lead_id:null},null,{blueprint_id:"bp",node_id:"node",event_type:"bad"},{blueprint_id:"bp",node_id:"node",event_type:"replied"}]}));
  expect(response.status).toBe(200);
  expect(insert).toHaveBeenCalledTimes(2);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc).toHaveBeenCalledWith("increment_flow_node_stat",expect.objectContaining({p_field:"entered",p_delta:1}));
});

it("validates Facebook actions while keeping numeric-string budgets compatible", () => {
  const source=readFileSync(resolve(process.cwd(),"supabase/functions/facebook-ads-toggle/index.ts"),"utf8");
  const snippet=source.slice(source.indexOf("  const checked ="),source.indexOf("  if (!checked.success)"));
  const compiled=ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2022}});
  const parse=new Function("z","rawBody",`${compiled.outputText};return checked;`) as (schema:typeof z,value:unknown)=>{success:boolean;data?:Record<string,unknown>};
  const valid=parse(z,{project_id:"project",entity_type:"campaign",entity_id:"id",action:"UPDATE_BUDGET",daily_budget:"12.50"});
  expect(valid.success).toBe(true);
  expect(valid.data?.daily_budget).toBe("12.50");
  expect(parse(z,{action:"DELETE"}).success).toBe(false);
  expect(parse(z,{new_name:{bad:true}}).success).toBe(false);
});

it("reports invalid UGC beats without throwing and preserves valid scripts", () => {
  const source=readFileSync(resolve(process.cwd(),"supabase/functions/ugc-pipeline/index.ts"),"utf8");
  const snippet=source.slice(source.indexOf("const MICRO_BEHAVIORS"),source.indexOf("// ------------ LLM call"));
  const compiled=ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2022}});
  const validate=new Function(`${compiled.outputText};return validateScript;`)() as (value:unknown)=>string[];
  const valid={hook:"A short hook",beats:[{t:0,line:"First"},{t:10,line:"Second"}],cta:"Learn more",tone:"casual",lane:"curiosity",age_bracket:"26-35"};
  expect(validate(valid)).toEqual([]);
  expect(validate({...valid,beats:[null,4]})).toEqual(["beats[0] must be object","beats[1] must be object"]);
});

it("keeps campaign paragraph breaks and zero day offsets", () => {
  const source=readFileSync(resolve(process.cwd(),"supabase/functions/wa-campaign-parse-text/index.ts"),"utf8");
  const snippet=source.slice(source.indexOf("    const steps ="),source.indexOf('    return new Response(JSON.stringify({ ok: true, steps: normalized })'));
  const compiled=ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2022}});
  const normalize=new Function("z","parsed",`${compiled.outputText};return normalized;`) as (schema:typeof z,data:unknown)=>unknown;
  expect(normalize(z,{steps:[{content:" First\n\nSecond ",send_time:"9:30",day_offset:0}]})).toEqual([{day_label:"",content:"First\n\nSecond",send_time:"09:30",day_offset:0}]);
});

function loadBackendHandler(name: string, database: unknown, fetchMock: unknown) {
  const source = readFileSync(resolve(process.cwd(), `supabase/functions/${name}/index.ts`), "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  let handler: Handler | undefined;
  new Function("Deno", "createClient", "fetch", "z", "serve", compiled.outputText)(
    { env: { get: () => "test" }, serve: (h: Handler) => { handler = h; } }, () => database, fetchMock, z, (h: Handler) => { handler = h; },
  );
  if (!handler) throw new Error("Handler not registered");
  return handler;
}
function queryResult(data: unknown, error: unknown = null) {
  const result = { data, error };
  const q = {
    returns: () => q, is: () => q, not: () => q, select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, gte: () => q, gt: () => q, contains: () => q,
    single: async () => result, maybeSingle: async () => result,
    then: (resolveResult: (value: typeof result) => unknown) => Promise.resolve(result).then(resolveResult),
  };
  return q;
}
describe("resume worker claims", () => {
  it.each(["lost", "error", "claimed"])("dispatches only an execution this worker claimed: %s", async mode => {
    const waiting = [{ id: "exec", automacao_id: "flow", project_id: "project", lead_id: "lead", trigger_tipo: "manual", current_step: 2, next_run_at: "2020-01-01", status: "waiting" }];
    const update = vi.fn((body: { status: string }) => queryResult(body.status === "running" && mode === "claimed" ? { id: "exec" } : null, body.status === "running" && mode === "error" ? { message: "claim failed" } : null));
    const database = { from: (table: string) => table === "imphq_flow_executions" ? { ...queryResult(waiting), update } : queryResult([{ trigger_data: { lead_data: { name: "Lead" } } }]) };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    const response = await loadBackendHandler("openflow-resume", database, fetchMock)(request({}));
    expect(response.status).toBe(200);
    if (mode === "claimed") {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    } else {
      expect(fetchMock).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledTimes(1);
    }
  });
});
describe("weekly backup verifies provider results", () => {
  it.each(["select", "upload", "signed-url", "email", "success"])("handles %s results without false success", async failure => {
    const upload = vi.fn(async () => ({ error: failure === "upload" ? { message: "upload failed" } : null }));
    const createSignedUrl = vi.fn(async () => ({ data: failure === "signed-url" ? null : { signedUrl: "https://test/download" }, error: failure === "signed-url" ? { message: "sign failed" } : null }));
    const database = {
      from: (table: string) => queryResult(table === "imphq_projects" ? [{ id: "project", name: "Project" }] : table === "imphq_integration_credentials" ? null : [], failure === "select" && table === "imphq_leads" ? { message: "select failed" } : null),
      storage: { createBucket: async () => ({ error: null }), from: () => ({ upload, createSignedUrl }) },
    };
    const fetchMock = vi.fn(async () => new Response("{}", { status: failure === "email" ? 429 : 200 }));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await loadBackendHandler("weekly-backup", database, fetchMock)(request({}));
      if (["select", "upload", "signed-url"].includes(failure)) {
        expect(response.status).toBe(500);
        expect(fetchMock).not.toHaveBeenCalled();
      } else {
        expect(response.status).toBe(200);
        expect(upload).toHaveBeenCalledTimes(3);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const deliveryLogs = log.mock.calls.filter(call => String(call[0]).includes("Email sent"));
        expect(deliveryLogs).toHaveLength(failure === "email" ? 0 : 1);
        if (failure === "email") expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to send email"), "Resend HTTP 429");
      }
    } finally { log.mockRestore(); error.mockRestore(); }
  });
});
it("keeps action payload extensions and nullable optional defaults", () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/imperius-executor/index.ts"), "utf8");
  const snippet = source.slice(source.indexOf("const actionPayloadSchema"), source.indexOf("interface QueuedAction"));
  const compiled = ts.transpileModule(snippet, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  const schema = new Function("z", `${compiled.outputText}; return actionPayloadSchema;`)(z) as z.ZodType;
  expect(schema.parse({ model: "studio-model", params: { duration: 4 }, new_budget: "25", text: null })).toEqual({ model: "studio-model", params: { duration: 4 }, new_budget: "25", text: null });
  expect(schema.safeParse({ text: { bad: true } }).success).toBe(false);
});

function loadContractPrefix(name: string, names: string) {
  const source = readFileSync(resolve(process.cwd(), `supabase/functions/${name}/index.ts`), "utf8").replace(/^import .*;\r?\n/gm, "");
  const prefix = source.slice(0, source.indexOf("Deno.serve"));
  const compiled = ts.transpileModule(prefix, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  return new Function("z", "Deno", `${prefix.includes("const corsHeaders") ? "" : "const corsHeaders = {};"}${compiled.outputText}; return { ${names} };`)(z, { env: { get: () => "test" } });
}
it("keeps Facebook numeric metrics and maps expired token errors", async () => {
  const contracts = loadContractPrefix("facebook-ads-sync", "graphResponseSchema, buildFacebookErrorResponse") as { graphResponseSchema: z.ZodType; buildFacebookErrorResponse: (v: unknown) => Response };
  const payload = { data: [{ spend: "12.50", actions: [{ action_type: "purchase", value: 2 }], creative: { name: "Creative", custom: "preserved" } }] };
  expect(contracts.graphResponseSchema.parse(payload)).toMatchObject({ data: [{ spend: "12.50", actions: [{ value: "2" }], creative: { custom: "preserved" } }] });
  expect(await contracts.buildFacebookErrorResponse({ error: { code: "190", message: "Expired" } }).json()).toMatchObject({ error_code: "FACEBOOK_INVALID_TOKEN" });
  expect(await contracts.buildFacebookErrorResponse("requires ads_read").json()).toMatchObject({ error_code: "FACEBOOK_MISSING_ADS_PERMISSION" });
  expect(contracts.graphResponseSchema.safeParse({ data: [{ actions: [{}] }] }).success).toBe(false);
});
it("preserves journey context from legacy JSON and selects preferred checkout", () => {
  const contracts = loadContractPrefix("journey-orchestrator", "buildProductContext") as { buildProductContext: (v: unknown, index: number) => Record<string, unknown> };
  const data = { avatar: "Avatar text", briefing: { dores: ["pain"], produtos: [{ nome: "Product", preco_por: "49", links: [{ tipo: "checkout", url: "first" }, { tipo: "checkout", prioridade_ia: "preferido", url: "preferred" }] }] } };
  expect(contracts.buildProductContext({ name: "Project", data: JSON.stringify(data) }, 0)).toMatchObject({ produto: "Product", preco: "49", avatar_resumo: "Avatar text", dores: ["pain"], link_checkout: "preferred" });
});
it("preserves legacy email template extensions and rejects invalid nested templates", () => {
  const contracts = loadContractPrefix("send-project-email", "projectMailSchema") as { projectMailSchema: z.ZodType };
  const value = { checklist: { resend: { from_name: null } }, email_config: { templates: [{ id: "template", name: "Name", subject: "Subject", html_body: "<p>Hi</p>", extension: true }] } };
  expect(contracts.projectMailSchema.parse(value)).toEqual(value);
  expect(contracts.projectMailSchema.safeParse({ email_config: { templates: "bad" } }).success).toBe(false);
});

it("retries failed payment recovery, then skips the successfully delivered level", async () => {
  let saleData: Record<string, unknown> = {};
  const sale = { id: "sale", lead_id: "lead", project_id: "project", valor: 49, produto_nome: "Product", status: "pendente", created_at: new Date(Date.now() - 30 * 60_000).toISOString() };
  const update = vi.fn((value: { data: Record<string, unknown> }) => { saleData = value.data; return queryResult(null); });
  const database = { from: (table: string) => {
    const data = table === "imphq_vendas" ? [{ ...sale, data: saleData }] : table === "imphq_leads" ? { id: "lead", nome: "Person", phone: "5511999999999", project_id: "project" } : table === "imphq_whatsapp_config" ? { id: "provider", provider: "evolution", api_url: "https://provider.test", api_key: "test", instance_name: "test" } : null;
    const q = queryResult(data);
    return { ...q, gte: () => q, update, insert: async () => ({ error: null }) };
  } };
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
  const handler = loadBackendHandler("payment-recovery", database, fetchMock);
  expect(await (await handler(request({}))).json()).toMatchObject({ sent: 0 });
  expect(saleData.recovery_sent_levels).toEqual([]);
  expect(await (await handler(request({}))).json()).toMatchObject({ sent: 1 });
  expect(saleData.recovery_sent_levels).toEqual([1]);
  expect(await (await handler(request({}))).json()).toMatchObject({ sent: 0, skipped: 1 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("maps webhook nested arrays and preserves zero/false values", () => {
  const contracts = loadContractPrefix("openflow-webhook", "getPath, firstOf") as { getPath: (v: unknown, p: string) => unknown; firstOf: (v: unknown, paths: string[]) => unknown };
  const payload = { rows: [{ amount: 0, enabled: false }], fallback: 42 };
  expect(contracts.getPath(payload, "rows.0.amount")).toBe(0);
  expect(contracts.firstOf(payload, ["missing", "rows.0.enabled", "fallback"])).toBe(false);
  expect(contracts.getPath({ nested: null }, "nested.name")).toBeUndefined();
});
it("decodes Zernio map and array actions and keeps provider extension data", () => {
  const contracts = loadContractPrefix("zernio-ads-sync", "responseSchema, pickAction") as { responseSchema: z.ZodType; pickAction: (v: unknown, t: string) => number };
  expect(contracts.pickAction({ purchase: "7" }, "purchase")).toBe(7);
  expect(contracts.pickAction([{ action_type: "purchase", value: 4 }], "purchase")).toBe(4);
  expect(contracts.pickAction([null, 2], "purchase")).toBe(0);
  expect(contracts.responseSchema.parse({ ads: [{ id: 12, metrics: { spend: 4.2, actions: { lead: 3 } }, extension: true }] })).toMatchObject({ ads: [{ id: "12", metrics: { spend: "4.2", actions: { lead: "3" } }, extension: true }] });
});
it("keeps generated blueprint block extensions and product aliases", () => {
  const contracts = loadContractPrefix("flow-generator", "blueprintSchema, projectContextSchema") as { blueprintSchema: z.ZodType; projectContextSchema: z.ZodType };
  const blueprint = { nodes: [{ id: "node", blocks: [{ id: "image", type: "image", image_prompt: "Photo", extension: { keep: true } }], extra: 2 }], extension: true };
  expect(contracts.blueprintSchema.parse(blueprint)).toEqual(blueprint);
  expect(contracts.projectContextSchema.parse({ briefing: { products: [{ name: "Product" }] } })).toMatchObject({ briefing: { products: [{ name: "Product" }] } });
});

it("hot lead failure remains retryable and success is not resent", async () => {
  let meta: Record<string, unknown> = { hot_lead_responder_sent: "old", hot_lead_responder_ok: false };
  const sale = { id: "sale", lead_id: "lead", project_id: "project", valor: 49, produto_nome: "Product", status: "pendente", created_at: new Date().toISOString() };
  const statuses: unknown[] = [];
  const update = (v: { data: Record<string, unknown> }) => { meta = v.data; return queryResult(null); };
  const database = { from: (table: string) => {
    const data = table === "imphq_vendas" ? [{ ...sale, data: meta }] : table === "imphq_leads" ? { id: "lead", nome: "Person", phone: "5511999999999", project_id: "project", score: 90 } : table === "imphq_wa_providers" ? { id: "provider", provider: "evolution", api_url: "https://provider.test", api_key: "test", instance_name: "test" } : null;
    const q = queryResult(data);
    const originalEq = q.eq;
    q.eq = (...args: unknown[]) => { if (table === "imphq_ai_actions") statuses.push(args); return originalEq(); };
    return { ...q, update, insert: async () => ({ error: null }) };
  } };
  const providerFetch = vi.fn().mockResolvedValueOnce(new Response("failed", { status: 503 })).mockResolvedValueOnce(new Response("{}"));
  const fetchMock = vi.fn((url: string) => url.includes("openrouter") ? Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: "Hello" } }] }))) : providerFetch());
  const handler = loadBackendHandler("hot-lead-responder", database, fetchMock);
  expect(await (await handler(request({ venda_id: "sale" }))).json()).toMatchObject({ sent: 0 });
  expect(meta.hot_lead_responder_sent).toBeNull();
  expect(await (await handler(request({ venda_id: "sale" }))).json()).toMatchObject({ sent: 1 });
  expect(meta.hot_lead_responder_sent).toEqual(expect.any(String));
  expect(await (await handler(request({ venda_id: "sale" }))).json()).toMatchObject({ sent: 0, skipped: 1 });
  expect(providerFetch).toHaveBeenCalledTimes(2);
  expect(statuses).toContainEqual(["status", "executed"]);
});
it.each(["http-error", "provider-error", "missing-provider"])("keeps behavioral follow-up pending on %s and sends it once after recovery", async failure => {
  let stepResults: unknown[] = [];
  let recovered = false;
  const update = vi.fn((v: { step_results: unknown[] }) => { stepResults = v.step_results; return queryResult(null); });
  const database = { from: (table: string) => {
    const data = table === "imphq_flow_executions" ? [{ id: "exec", automacao_id: "flow", project_id: "project", lead_id: "lead", current_step: 0, step_results: stepResults, updated_at: "2020-01-01", created_at: "2020-01-01" }] : table === "imphq_automacoes" ? [{ id: "flow", nome: "Flow", follow_up_hours: 1, follow_up_template: "Hi {{nome}}", provider_id: failure === "missing-provider" && !recovered ? null : "provider" }] : table === "imphq_leads" ? { id: "lead", nome: "Person", phone: "5511999999999" } : [];
    return { ...queryResult(data), update };
  } };
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: recovered }), { status: !recovered && failure === "http-error" ? 503 : 200 }));
  const handler = loadBackendHandler("wa-behavioral-triggers", database, fetchMock);
  expect(await (await handler(request({}))).json()).toMatchObject({ follow_ups_sent: 0 });
  expect(update).not.toHaveBeenCalled();
  recovered = true;
  expect(await (await handler(request({}))).json()).toMatchObject({ follow_ups_sent: 1 });
  expect(update).toHaveBeenCalledTimes(1);
  expect(await (await handler(request({}))).json()).toMatchObject({ follow_ups_sent: 0 });
  expect(update).toHaveBeenCalledTimes(1);
});

it("preserves webhook aliases, empty optional fields and future payload metadata", () => {
  const { WebhookPayload } = loadContractPrefix("zernio-webhook", "WebhookPayload") as { WebhookPayload: z.ZodType };
  const input = { event: "message.received", data: { message: { messageId: "m", attachments: [{ originalType: "story", payload: { url: null } }], context: { story: "story-id" }, future: false }, conversation: { participantId: "p", participants: [{ role: "customer", id: "p", instagramProfile: { followerCount: 0, isFollower: false } }] } }, future: "kept" };
  expect(WebhookPayload.parse(input)).toEqual(input);
  expect(WebhookPayload.parse({ event: "comment.received", message: "flattened comment", commentId: "c" })).toMatchObject({ message: "flattened comment" });
});
it("keeps custom blueprint blocks while rewriting text blocks only", () => {
  const contracts = loadContractPrefix("sales-script-autopilot", "ScriptBlueprint, rewriteNodeText") as { ScriptBlueprint: z.ZodType; rewriteNodeText: (v: unknown, text: string) => void };
  const node = { title: "Hook", blocks: [{ type: "text", text: "old", custom: 0 }, { type: "image", url: "image" }, { text: "last" }] };
  expect(contracts.ScriptBlueprint.parse({ nodes: [node], meta: { extra: false } })).toMatchObject({ nodes: [node], meta: { extra: false } });
  contracts.rewriteNodeText(node, "first\n\nsecond");
  expect(node.blocks).toEqual([{ type: "text", text: "first", custom: 0 }, { type: "image", url: "image" }, { text: "second" }]);
});
it("accepts generated copy extension blocks and absent source index", () => {
  const { GeneratedCopies } = loadContractPrefix("swipe-generate", "GeneratedCopies") as { GeneratedCopies: z.ZodType };
  const input = { copies: [{ title: null, blocks: { gancho: "Hello", custom: { active: false } } }] };
  expect(GeneratedCopies.parse(input)).toEqual(input);
});

it.each(["pauseAd", "adjustBudget", "resumeAi", "updateLead"])("reverts %s using stored state without repeating original action", async kind => {
  const payloads = { pauseAd: { entity_id: "ad", new_status: "ACTIVE" }, adjustBudget: { entity_id: "ad", new_budget: 0 }, resumeAi: { conversation_id: "conversation", restore_paused_until: "2030-01-01" }, updateLead: { lead_id: "lead", updates: { score: 0 } } };
  const payload = payloads[kind as keyof typeof payloads];
  const invoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
  const update = vi.fn(() => queryResult({ id: "target" }));
  const db = { auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) }, functions: { invoke }, from: () => ({ ...queryResult({ id: "action", kind, status: "executed", revert_payload: payload }), update }) };
  const response = await loadBackendHandler("imperius-executor", db, vi.fn())(new Request("http://test", { method: "POST", headers: { Authorization: "Bearer mock" }, body: JSON.stringify({ action_id: "action", mode: "revert" }) }));
  expect(await response.json()).toEqual({ ok: true });
  if (kind === "pauseAd") expect(invoke.mock.calls[0][1].body.new_status).toBe("ACTIVE");
  if (kind === "adjustBudget") expect(invoke.mock.calls[0][1].body.new_budget).toBe(0);
  if (kind === "resumeAi") expect(update).toHaveBeenCalledWith({ ai_paused_until: "2030-01-01" });
  if (kind === "updateLead") expect(update).toHaveBeenCalledWith({ score: 0 });
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ status: "reverted" }));
});
it.each(["createTask", "createFlow", "provider-failure", "missing-budget"])("keeps executed action retryable on unsupported/failed revert: %s", async mode => {
  const invoke = vi.fn().mockResolvedValue({ data: { success: false }, error: null });
  const update = vi.fn();
  const action = { id: "action", kind: mode === "provider-failure" ? "pauseAd" : mode === "missing-budget" ? "adjustBudget" : mode, status: "executed", revert_payload: { entity_id: "ad", new_status: "ACTIVE", task_id: "task", flow_id: "flow" } };
  const db = { auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) }, functions: { invoke }, from: () => ({ ...queryResult(action), update }) };
  const response = await loadBackendHandler("imperius-executor", db, vi.fn())(new Request("http://test", { method: "POST", headers: { Authorization: "Bearer mock" }, body: JSON.stringify({ action_id: "action", mode: "revert" }) }));
  expect(await response.json()).toMatchObject({ ok: false, error: expect.any(String) });
  expect(update).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenCalledTimes(mode === "provider-failure" ? 1 : 0);
});
it("retains failed offline batches and unmatched sales for retry", async () => {
  const sales = Array.from({ length: 102 }, (_, i) => ({ id: `sale-${i}`, lead_id: i === 101 ? "unmatched" : "lead", data_venda: "2026-09-01", valor: 10 }));
  const synced = new Set<string>();
  const db = { from: (table: string) => {
    const data = table === "imphq_projects" ? { id: "project", meta_offline_event_set_id: "events", fb_access_token: "mock" } : table === "imphq_leads" ? [{ id: "lead", email: "a@example.com" }] : sales.filter(sale => !synced.has(sale.id));
    return { ...queryResult(data), update: () => ({ in: async (_column: string, ids: string[]) => { ids.forEach(id => synced.add(id)); return { error: null }; } }) };
  } };
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response("{}"));
  const handler = loadBackendHandler("meta-offline-upload", db, fetchMock);
  const cryptoMock = { subtle: { digest: async () => new Uint8Array([1, 2]).buffer } };
  vi.stubGlobal("crypto", cryptoMock);
  try {
    const result = await (await handler(request({ project_id: "project" }))).json();
    expect(result.results[0]).toMatchObject({ uploaded: 1, total_candidates: 102 });
    expect([...synced]).toEqual(["sale-100"]);
    fetchMock.mockResolvedValue(new Response("{}"));
    await handler(request({ project_id: "project" }));
    expect(synced.size).toBe(101);
    expect(synced.has("sale-101")).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});
it("retries a failed consultive touch before advancing the sequence", async () => {
  let state: Record<string, unknown> = {};
  const updates = vi.fn((body: { followup_state: Record<string, unknown> }) => { state = body.followup_state; return queryResult(null); });
  const db = { from: (table: string) => {
    const data = table === "imphq_wa_conversations" ? [{ id: "c", phone: "123", lead_id: "lead", project_id: "p", last_message_at: new Date(Date.now() - 3 * 3600000).toISOString(), followup_state: state }] : table === "imphq_wa_ai_config" ? { consultive_followup_enabled: true, business_hours: { start: 0, end: 24, days: [0, 1, 2, 3, 4, 5, 6] } } : table === "imphq_wa_messages" ? [] : table === "imphq_leads" ? { nome: "Person", project_id: "p" } : table === "imphq_projects" ? { name: "Project" } : { id: "provider" };
    return { ...queryResult(data), update: updates, insert: async () => ({ error: null }) };
  } };
  const sends = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response('{"success":true}'));
  const fetchMock = vi.fn((url: string) => url.includes("lovable") ? Promise.resolve(new Response('{}', { status: 503 })) : sends());
  const handler = loadBackendHandler("wa-consultive-followup", db, fetchMock);
  expect(await (await handler(request({}))).json()).toMatchObject({ sent: 0 });
  expect(state.last_touch).toBe(0);
  expect(await (await handler(request({}))).json()).toMatchObject({ sent: 1 });
  expect(state.last_touch).toBe(1);
  expect(await (await handler(request({}))).json()).toMatchObject({ sent: 0 });
  expect(sends).toHaveBeenCalledTimes(2);
});

it("checks webchat domain boundaries and explicit origin scheme/port", () => {
  const { originAllowed } = loadContractPrefix("webchat-api", "originAllowed") as { originAllowed: (widget: { allowed_origins: string[] }, origin: string | null) => boolean };
  const widget = { allowed_origins: ["example.com"] };
  expect(originAllowed(widget, "https://example.com")).toBe(true);
  expect(originAllowed(widget, "https://lp.example.com")).toBe(true);
  for (const origin of ["https://badexample.com", "https://example.com.evil.test", "https://evil.test/example.com", "https://example.com:444", "null", null]) expect(originAllowed(widget, origin)).toBe(false);
  expect(originAllowed({ allowed_origins: ["https://example.com"] }, "http://example.com")).toBe(false);
  expect(originAllowed({ allowed_origins: ["https://example.com:444"] }, "https://example.com:444")).toBe(true);
  expect(originAllowed({ allowed_origins: [] }, null)).toBe(true);
  expect(originAllowed({ allowed_origins: ["*"] }, "https://other.test")).toBe(true);
});

it("does not send substitute music when voice synthesis is unavailable", async () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/whatsapp-api/index.ts"), "utf8");
  const start = source.indexOf('if (action === "send_voice_synthesis")');
  const end = source.indexOf('// ── ACTION: simulate_ai_reply', start);
  const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const fetchMock = vi.fn();
  const from = vi.fn();
  const branch = new Function("Deno", "fetch", "supabase", "getProvider", `return async function(req) { const action = "send_voice_synthesis"; const corsHeaders = {}; ${compiled} };`)(
    { env: { get: () => undefined } }, fetchMock, { from }, async () => ({ provider: "evolution" }),
  ) as Handler;
  await expect(branch(request({ provider_id: "p", phone: "5511999999999", text: "Hello" }))).rejects.toThrow("Nenhum áudio foi enviado");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it("campaign scheduler retries failed groups without resending successful groups", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
  const logs = [{ id: "old", step_id: "step", group_jid: "retry@g.us", status: "failed" }, { id: "sent", step_id: "step", group_jid: "done@g.us", status: "sent" }];
  const campaign = { id: "campaign", name: "Campaign", groups: ["retry@g.us", "done@g.us"], provider_id: "provider", start_date: "2026-09-07", imphq_wa_campaign_steps: [{ id: "step", is_active: true, days_offset: 0, send_time: "09:00", content: "Hello", media_type: "text" }] };
  const db = { from: (table: string) => {
    if (table === "imphq_wa_campaign_logs") {
      const filters: Record<string, string> = {};
      const q = { select: () => q, eq: (key: string, value: string) => { filters[key] = value; return q; }, gte: () => q, lte: () => q, limit: async () => ({ data: logs.filter(log => Object.entries(filters).every(([key, value]) => log[key as keyof typeof log] === value)), error: null }), insert: async (log: typeof logs[number]) => { logs.push(log); return { error: null }; } };
      return q;
    }
    const q = queryResult(table === "imphq_wa_campaigns" ? [campaign] : { api_url: "https://provider.test", api_key: "mock", instance_name: "test" });
    return { ...q, eq: () => ({ ...q, returns: () => q }) };
  } };
  const send = vi.fn().mockImplementation(async () => new Response("{}"));
  try {
    const handler = loadBackendHandler("wa-campaign-scheduler", db, send);
    expect(await (await handler(request({}))).json()).toMatchObject({ sent: 1, failed: 0 });
    expect(await (await handler(request({}))).json()).toMatchObject({ sent: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(logs.filter(log => log.group_jid === "retry@g.us" && log.status === "sent")).toHaveLength(1);
  } finally { vi.useRealTimers(); }
});

it.each([0, 1])("Instagram LLM branch %s resolves its provider key in the active scope", async index => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/instagram-webhook/index.ts"), "utf8");
  const starts = [...source.matchAll(/const maxTokens =/g)].map(match => match.index);
  const start = starts[index];
  const end = source.indexOf("let aiRes:", start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const fetchMock = vi.fn(async () => new Response("{}"));
  const run = new Function("Deno", "fetch", "aiConfig", `const formattedMessages = []; const messages = []; const temperature = 0.7; const top_p = 1; ${code}; return callLLM;`)({ env: { get: () => "mock-key" } }, fetchMock, { max_tokens: 123 }) as (model: string) => Promise<Response>;
  await run("test-model");
  expect(fetchMock).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer mock-key" }), body: expect.stringContaining('"max_tokens":123') }));
});

it("runs existing payment webhook parser regressions with the local runtime", async () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/webhook-pagamento/index.ts"), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/export function|export async function/g, match => match.replace("export ", ""));
  const code = ts.transpileModule(source.slice(0, source.indexOf("Deno.serve")), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const tests = readFileSync(resolve(process.cwd(), "supabase/functions/webhook-pagamento/index.test.ts"), "utf8").replace(/import[\s\S]*?from [^;]+;/g, "");
  const testCode = ts.transpileModule(tests, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const cases: Array<{ name: string; run: () => Promise<void> | void }> = [];
  new Function("z", "Deno", "assertEquals", "assertExists", "assertNotEquals", `${code}\n${testCode}\nassertEquals(parseTictoDate("06/12/2025 10:30:00"), "2025-12-06T13:30:00.000Z");`)(z, { test: (name: string, run: () => Promise<void> | void) => cases.push({ name, run }) }, (a: unknown, b: unknown) => expect(a).toEqual(b), (a: unknown) => expect(a).not.toBeNull(), (a: unknown, b: unknown) => expect(a).not.toEqual(b));
  expect(cases.length).toBeGreaterThan(10);
  for (const test of cases) await test.run();
});

it("normalizes legacy OpenFlow steps while preserving media and pacing", () => {
  const contracts = loadContractPrefix("openflow-executor", "normalizeStep, replaceVariables") as { normalizeStep: (value: unknown) => Record<string, unknown>; replaceVariables: (text: string, data: unknown, lead: unknown) => string };
  expect(contracts.normalizeStep({ tipo: "aguardar", delay_sec: 2, template: "Hello", custom: { routing: true } })).toMatchObject({ tipo: "delay", delay_sec: 2, delay_min: 0, mensagem: "Hello", custom: { routing: true } });
  expect(contracts.normalizeStep({ tipo: "delay", delay_min: "0" })).toMatchObject({ delay_min: 0 });
  expect(contracts.normalizeStep({ tipo: "whatsapp", media: { id: "image", url: "https://example.test/image.png", label: "Photo", kind: "image" } })).toMatchObject({ media: { kind: "image" } });
  expect(contracts.replaceVariables("Hello {{nome}}, {{offer.code}} / {{unknown}}", { nome: "Ana" }, { lead_memory: { offer: { code: "SAVE" } } })).toBe("Hello Ana, SAVE / {{unknown}}");
});

it.each(["http", "network", "payload", "complete"])("records only confirmed WhatsApp response parts: %s", async mode => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/wa-ai-reply/index.ts"), "utf8");
  const start = source.indexOf("let sendSuccess = false;");
  const end = source.indexOf("if (sendSuccess) {", start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{"key":{"id":"first"}}'));
  if (mode === "network") fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
  else fetchMock.mockResolvedValueOnce(new Response(mode === "payload" ? JSON.stringify({ success: false }) : "{}", { status: mode === "http" ? 503 : 200 }));
  const run = new Function("fetch", "setTimeout", `return async () => { const provider = {provider:"evolution", api_url:"https://provider.test", instance_name:"test", api_key:"mock"}; const phone="123"; const responseAudioUrl=null; const messageParts=["First part", "Second part"]; let finalAiReply=messageParts.join("\\n\\n"); const errorMessage = error => String(error); ${code}; return {partialSend, confirmedParts, finalAiReply}; }`)(fetchMock, (callback: () => void) => callback()) as () => Promise<{ partialSend: boolean; confirmedParts: string[]; finalAiReply: string }>;
  const result = await run();
  expect(result.partialSend).toBe(mode !== "complete");
  expect(result.confirmedParts).toEqual(mode === "complete" ? ["First part", "Second part"] : ["First part"]);
  expect(result.finalAiReply).toBe(mode === "complete" ? "First part\n\nSecond part" : "First part");
});

it("validates Instagram request fields and redacts nested provider credentials", () => {
  const contracts = loadContractPrefix("instagram-api", "requestSchema, sanitizePayload") as { requestSchema: z.ZodType; sanitizePayload: (value: unknown) => unknown };
  expect(contracts.requestSchema.parse({ action: "send_message", text: "Hello", metadata: { campaign: "x" }, avatar_url: null })).toMatchObject({ text: "Hello", metadata: { campaign: "x" }, avatar_url: null });
  expect(contracts.requestSchema.safeParse({ icebreakers: [42] }).success).toBe(false);
  expect(contracts.sanitizePayload({ token: "secret", items: [{ api_key: "secret", message: "Hello" }] })).toEqual({ token: "[REDACTED]", items: [{ api_key: "[REDACTED]", message: "[len=5]" }] });
});

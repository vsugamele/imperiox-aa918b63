#!/usr/bin/env node
// CLI: node scripts/project-cycle.mjs --project slimsoda --objective "Validar oferta" [--local]
// MCP: IMPERIO_MCP_URL + IMPERIO_MCP_KEY no ambiente. --record --cycle-id UUID registra o diário.
// --local usa SQL do projeto linkado; só grava o diário com --record explícito, sem chave MCP.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { loadProjectCycle, recordProjectCycle } from "../supabase/functions/_shared/project-cycle-load.ts";
import { loadProjectLivePanel } from "../supabase/functions/_shared/live-panel-load.ts";
import { accessChecklist, channelsFromPlaybooks } from "../supabase/functions/_shared/launch-kit.ts";
import { adsSyncHealth } from "../supabase/functions/_shared/live-panel.ts";

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const projectId = flag("project");
const objective = flag("objective");
const record = args.includes("--record");
if (!projectId || projectId.startsWith("--")) throw new Error("Informe --project <ID exato do projeto>");
if (record && !flag("cycle-id")) throw new Error("Registro requer --cycle-id UUID para permitir repetição segura");

let result;
if (args.includes("--local")) {
  const q = v => `'${String(v).replaceAll("'", "''")}'`;
  const p = q(projectId);
  const selections = {
    imphq_projects: `select id,name,avatar,data,clarity_id,ga_id,updated_at from imphq_projects where id=${p}`,
    imphq_project_sites: `select site_id,papel,projeto_id from imphq_project_sites where projeto_id=${p} limit 100`,
    imphq_sites: `select s.id,s.titulo,s.url,s.tipo,s.status,s.updated_at from imphq_sites s join imphq_project_sites p on p.site_id=s.id where p.projeto_id=${p} limit 100`,
    imphq_referencias: `select id,project_id,titulo,url,tipo,produto,updated_at from imphq_referencias where project_id=${p} order by updated_at desc limit 100`,
    imphq_skill_outputs: `select id,project_id,skill_id,skill_nome,produto,created_at,outcome_score from imphq_skill_outputs where project_id=${p} order by created_at desc limit 100`,
    imphq_project_goals: `select * from imphq_project_goals where project_id=${p} order by ano desc,mes desc limit 100`,
    imphq_competitors: `select id,project_id,name,url from imphq_competitors where project_id=${p} limit 100`,
    imphq_company_map_nodes: `select id,linked_project_id,label,kind,step_status,linked_skill_id,notes,url from imphq_company_map_nodes where linked_project_id=${p} limit 100`,
    imphq_scale_rounds: `select id,project_id,fase,rodada,params,resultado,updated_at from imphq_scale_rounds where project_id=${p} order by updated_at desc limit 100`,
    imphq_metrics_daily: `select project_id,source,data_ref,scroll_depth_medio,updated_at from imphq_metrics_daily where project_id=${p} and source='clarity' order by data_ref desc limit 100`,
    imphq_ads_spend: `select project_id,data_ref,valor,landing_page_views,checkouts_iniciados,init_checkout,compras,valor_conversao,moeda from imphq_ads_spend where project_id=${p} and data_ref >= current_date - 7 limit 5000`,
    imphq_vendas: `select project_id,status,valor,data,tipo_venda,created_at from imphq_vendas where project_id=${p} and created_at >= now()-interval '30 days' limit 5000`,
    imphq_events: `select project_id,event_name,created_at from imphq_events where project_id=${p} and created_at >= now()-interval '7 days' limit 5000`,
    imphq_v_ads_sync_health: `select * from imphq_v_ads_sync_health where project_id=${p}`,
    imphq_project_access: `select access_key,status,nota,owner_member_id,updated_at from imphq_project_access where project_id=${p} limit 100`,
    imphq_playbook_applications: `select playbook_id from imphq_playbook_applications where project_id=${p} limit 100`,
    imphq_wa_providers: `select id,is_active from imphq_wa_providers where project_id=${p}`,
    imphq_activity_log: `select id,project_id,action,created_at,details from imphq_activity_log where project_id=${p} and action='project_cycle' order by created_at desc limit 100`,
  };
  const sql = `select jsonb_build_object(${Object.entries(selections).map(([table, select]) => `${q(table)},(select coalesce(jsonb_agg(t),'[]'::jsonb) from (${select}) t)`).join(",")}) as snapshot;`;
  mkdirSync(".tmp-cycle", { recursive: true });
  const file = `.tmp-cycle/${randomUUID()}.sql`;
  writeFileSync(file, sql);
  const { stdout } = await promisify(execFile)(process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, shell: process.platform === "win32" });
  const tables = JSON.parse(stdout.slice(stdout.indexOf("{"))).rows?.[0]?.snapshot;
  if (!tables) throw new Error("Banco não devolveu snapshot do projeto");
  const db = { from(table) {
    let records = [...(tables[table] ?? [])], cap = Infinity;
    const query = {
      select: () => query,
      eq: (k, v) => { records = records.filter(r => r[k] === v); return query; },
      in: (k, v) => { records = records.filter(r => v.includes(r[k])); return query; },
      gte: (k, v) => { records = records.filter(r => r[k] >= v); return query; },
      lt: (k, v) => { records = records.filter(r => r[k] < v); return query; },
      order: (k, options) => { records.sort((a, b) => String(a[k] ?? "").localeCompare(String(b[k] ?? "")) * (options.ascending ? 1 : -1)); return query; },
      limit: n => { cap = n; return query; },
      maybeSingle: async () => ({ data: records[0] ?? null, error: null }),
      then: (resolve, reject) => Promise.resolve({ data: records.slice(0, cap), count: records.length, error: null }).then(resolve, reject),
    };
    return query;
  } };
  result = await loadProjectCycle(db, projectId, {
    live: () => loadProjectLivePanel(db, projectId),
    kit: async () => ({ ...accessChecklist(channelsFromPlaybooks(tables.imphq_playbook_applications.map(r => r.playbook_id)), tables.imphq_project_access, {}),
      saude_sync_anuncios: adsSyncHealth(tables.imphq_v_ads_sync_health[0] ?? null) }),
    briefing: async () => { throw new Error("Resumo completo disponível pela chamada MCP; leitura local usa inventário e painel."); },
  }, objective);
  result.transport = "local_read_only";
  result.snapshot_limits = "Até 100 cadastros/fonte e 5000 registros transacionais. Kit local usa acessos declarados; sinais de integração devem ser revalidados via MCP.";
  if (["imphq_events", "imphq_ads_spend", "imphq_vendas"].some(t => tables[t].length === 5000)) {
    result.economics.ready_for_decisions = false;
    result.economics.gaps.push("Snapshot transacional atingiu o limite; consultar MCP antes de concluir sobre economia.");
  }
  if (record) {
    const query = async sqlText => {
      const queryFile = `.tmp-cycle/${randomUUID()}.sql`;
      writeFileSync(queryFile, sqlText);
      const { stdout: queryOutput } = await promisify(execFile)(process.platform === "win32" ? "npx.cmd" : "npx",
        ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", queryFile],
        { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, shell: process.platform === "win32" });
      return JSON.parse(queryOutput.slice(queryOutput.indexOf("{"))).rows ?? [];
    };
    result = await recordProjectCycle(result, flag("cycle-id"), projectId, {
      insert: async row => {
        const saved = await query(`insert into imphq_activity_log (id,action,entity_type,entity_id,project_id,actor,source,details) values (${q(row.id)}::uuid,${q(row.action)},${q(row.entity_type)},${q(row.entity_id)},${q(row.project_id)},${q(row.actor)},'project-cycle-cli',${q(JSON.stringify(row.details))}::jsonb) on conflict (id) do nothing returning id`);
        return { error: saved.length ? null : { code: "23505" } };
      },
      find: async id => ({ data: (await query(`select project_id,action,details from imphq_activity_log where id=${q(id)}::uuid`))[0] ?? null, error: null }),
    });
  }
} else {
  const endpoint = process.env.IMPERIO_MCP_URL;
  const key = process.env.IMPERIO_MCP_KEY;
  if (!endpoint || !key) throw new Error("Configure IMPERIO_MCP_URL e IMPERIO_MCP_KEY no ambiente ou use --local (somente leitura).");
  const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(120000),
    headers: { "Content-Type": "application/json", "x-mcp-key": key },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: record ? "record_project_cycle" : "get_project_cycle",
      arguments: { project_id: projectId, objective, ...(record ? { cycle_id: flag("cycle-id") } : {}) },
    } }) });
  if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
  const envelope = await response.json();
  if (envelope.error) throw new Error(envelope.error.message);
  result = JSON.parse(envelope.result.content[0].text);
}
if (flag("output")) writeFileSync(flag("output"), `${JSON.stringify(result, null, 2)}\n`);
const cycle = result.cycle ?? result;
console.log(JSON.stringify({ project: cycle.project, objective: cycle.objective, observed_at: cycle.observed_at,
  sources: cycle.sources.map(s => ({ key: s.key, status: s.status, records: Array.isArray(s.data) ? s.data.length : undefined, problem: s.problem })),
  economics: cycle.economics, next_actions: cycle.next_actions, recorded: result.recorded ?? false }, null, 2));

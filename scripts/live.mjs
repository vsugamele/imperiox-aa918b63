#!/usr/bin/env node
// CLI do painel ao vivo (LIVE1.1): mesma regra da tela do projeto (supabase/functions/_shared/live-panel.ts).
//
//   node scripts/live.mjs --project jp_freitas [--dia 2026-08-18]
//
// Sem --dia: hoje (Brasília), com ritmo e projeção pela hora atual. Com --dia: o dia fechado.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adsSyncHealth, buildLivePanel, dayFraction } from "../supabase/functions/_shared/live-panel.ts";
import { paramsFrom } from "../supabase/functions/_shared/scale-ladder.ts";

const WORK_DIR = ".tmp-live";
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null; };
const project = flag("project");
if (!project) { console.error("Uso: node scripts/live.mjs --project <id> [--dia AAAA-MM-DD]"); process.exit(1); }

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let n = 0;
function query(sql) {
  mkdirSync(WORK_DIR, { recursive: true });
  const file = join(WORK_DIR, `query-${++n}.sql`);
  writeFileSync(file, sql);
  const out = execFileSync(npx, ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file.split("\\").join("/")], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32", env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  return JSON.parse(out.slice(out.indexOf("{"))).rows ?? [];
}
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const parse = (v) => { if (typeof v !== "string") return v ?? null; try { return JSON.parse(v); } catch { return v; } };

const day = flag("dia") ?? new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const start = `${day}T03:00:00.000Z`;
const end = new Date(Date.parse(start) + 86400000).toISOString();
const p = q(project);
const events = query(`select event_name, count(*)::int n from imphq_events where project_id = ${p} and event_name in ('PageView','InitiateCheckout') and created_at >= ${q(start)} and created_at < ${q(end)} group by 1`);
const sales = query(`select status, valor, data, tipo_venda from imphq_vendas where project_id = ${p} and created_at >= ${q(start)} and created_at < ${q(end)}`).map((s) => ({ ...s, valor: Number(s.valor), data: parse(s.data) }));
const ads = query(`select valor, landing_page_views, checkouts_iniciados, init_checkout, compras, valor_conversao, moeda from imphq_ads_spend where project_id = ${p} and data_ref = ${q(day)}`)
  .map((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, k === "moeda" ? v : v === null ? null : Number(v)])));
const [hook] = query(`select exists (select 1 from imphq_vendas where project_id = ${p} and created_at >= ${q(new Date(Date.parse(end) - 30 * 86400000).toISOString())} and created_at < ${q(end)}) as ok`);
const [round] = query(`select params from imphq_scale_rounds where project_id = ${p} order by updated_at desc limit 1`);
const params = round ? paramsFrom(parse(round.params)) : null;
const [health] = query(`select * from imphq_v_ads_sync_health where project_id = ${p}`);

const panel = buildLivePanel({
  trackerEvents: Object.fromEntries(events.map((e) => [e.event_name, e.n])),
  sales, ads, webhookConnected: !!hook?.ok,
  params: params && params.payout > 0 && params.cpaAlvo > 0 ? params : null,
  dayFraction: flag("dia") ? 1 : dayFraction(),
  syncHealth: flag("dia") ? null : adsSyncHealth(health ?? null),
});
console.log(JSON.stringify({ projeto: project, dia: day, ...panel }, null, 2));

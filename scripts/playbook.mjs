#!/usr/bin/env node
// CLI da biblioteca de estratégias (playbooks). Mesmo planejador e gravador do MCP apply_playbook (_shared/playbooks.ts,
// _shared/playbook-apply.ts), falando com o banco pela CLI do Supabase (projeto linkado), como scripts/content.mjs.
//
//   node scripts/playbook.mjs list
//   node scripts/playbook.mjs apply --project slimsoda --playbook esteira-escala-dtc [--map <id>] [--produto "SlimSoda"]
//        [--plataforma YouTube] [--conta @canal] [--confirmar]
//
// Sem --confirmar só mostra o plano. Com --confirmar: snapshot do mapa e gravação numa transação só.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { planPlaybook } from "../supabase/functions/_shared/playbooks.ts";
import { findProjectMap, playbookFromRows, writePlaybookPlan } from "../supabase/functions/_shared/playbook-apply.ts";

const WORK_DIR = ".tmp-playbook";
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : null; };
const has = (name) => rest.includes(`--${name}`);
const need = (name) => { const v = flag(name); if (!v) { console.error(`Falta --${name}`); process.exit(1); } return v; };

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let queryCount = 0;
function query(sql) {
  mkdirSync(WORK_DIR, { recursive: true });
  const file = join(WORK_DIR, `query-${++queryCount}.sql`);
  writeFileSync(file, sql);
  const out = execFileSync(npx, ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file.split("\\").join("/")], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32", env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  return JSON.parse(out.slice(out.indexOf("{"))).rows ?? [];
}
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const parse = (v) => { if (typeof v !== "string") return v ?? null; try { return JSON.parse(v); } catch { return v; } };

/** INSERT só com as colunas informadas (o resto fica no default), tipos convertidos pelo próprio Postgres. */
function insertSql(table, row) {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  return `insert into public.${table} (${cols.join(", ")}) select ${cols.join(", ")} from jsonb_populate_record(null::public.${table}, ${q(JSON.stringify(row))}::jsonb);`;
}

switch (cmd) {
  case "list": {
    console.table(query("select id, nome, familia, north_star, versao from imphq_playbooks where ativo order by familia, id"));
    break;
  }
  case "apply": {
    const projectId = need("project"), playbookId = need("playbook");
    const [proj] = query(`select id, name from imphq_projects where id = ${q(projectId)}`);
    if (!proj) throw new Error(`Projeto '${projectId}' não encontrado`);
    const [pbRow] = query(`select * from imphq_playbooks where id = ${q(playbookId)}`);
    if (!pbRow) throw new Error(`Playbook '${playbookId}' não encontrado`);
    const steps = query(`select * from imphq_playbook_steps where playbook_id = ${q(playbookId)} order by ordem`);
    const maps = query("select id, name, archived_at from imphq_company_maps");
    const map = flag("map") ? maps.find((m) => m.id === flag("map")) : findProjectMap(maps, proj.name);
    if (!map) throw new Error(`Nenhum mapa de operação para '${proj.name}'. Informe --map.`);

    const params = Object.fromEntries(Object.entries({ projeto: proj.name, produto: flag("produto") || proj.name, plataforma: flag("plataforma"), conta: flag("conta") })
      .filter(([, v]) => typeof v === "string" && v.trim() !== ""));
    const nodes = query(`select id, label, kind, position, height from imphq_company_map_nodes where map_id = ${q(map.id)}`).map((n) => ({ ...n, position: parse(n.position) }));
    const frames = query(`select y, height from imphq_company_map_annotations where map_id = ${q(map.id)} and kind = 'frame'`);
    const edges = query(`select source_id, target_id from imphq_company_map_edges where map_id = ${q(map.id)}`);
    const playbook = playbookFromRows({ ...pbRow, kpis: parse(pbRow.kpis), riscos: parse(pbRow.riscos) },
      steps.map((s) => ({ ...s, contrato: parse(s.contrato), metrica: parse(s.metrica), checklist: parse(s.checklist), depende_de: parse(s.depende_de) })));
    const plan = planPlaybook(playbook, { nodes, frames }, params);
    const labelOf = new Map(nodes.map((n) => [n.id, n.label]));

    console.log(`\n${playbook.nome} → mapa "${map.name}" (${map.id})`);
    console.table(plan.nodes.map((n) => ({ ordem: n.stepOrdem, secao: n.stage_role, etapa: n.label, tipo: n.kind, reaproveita: n.existingId ? labelOf.get(n.existingId) : "" })));
    console.log(`${plan.created} novas, ${plan.reused} reaproveitadas, ${plan.frames.length} seções.`);
    if (!has("confirmar")) { console.log("Nada gravado. Rode de novo com --confirmar para gravar."); break; }

    const sql = ["begin;", `select public.imphq_snapshot_company_map(${q(map.id)}::uuid, ${q(`Antes de aplicar o playbook ${playbook.id} (CLI)`)});`];
    const result = await writePlaybookPlan(plan, {
      playbook, mapId: map.id, projectId: proj.id, params, appliedBy: "cli",
      existingEdges: new Set(edges.map((e) => `${e.source_id}>${e.target_id}`)), newId: () => randomUUID(),
    }, {
      insertFrame: async (row) => { sql.push(insertSql("imphq_company_map_annotations", row)); },
      insertNode: async (row) => { const id = randomUUID(); sql.push(insertSql("imphq_company_map_nodes", { id, ...row })); return id; },
      insertEdge: async (row) => { sql.push(insertSql("imphq_company_map_edges", row)); },
      insertApplication: async (row) => { sql.push(insertSql("imphq_playbook_applications", row)); },
    });
    sql.push("commit;");
    query(sql.join("\n"));
    console.log(`Gravado: ${result.nodeIds.length} etapas (${result.created} novas), ${result.edges} setas, ${result.frames} seções. Snapshot do mapa salvo antes.`);
    break;
  }
  default:
    console.log("Uso: node scripts/playbook.mjs list | apply --project <id> --playbook <id> [--confirmar]");
}

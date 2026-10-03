#!/usr/bin/env node
// CLI do lançador de projetos (épico LAUNCH1). Regras em supabase/functions/_shared/launch-kit.ts; banco pela CLI do Supabase (projeto linkado).
//
//   node scripts/launch.mjs canais                                   canais, playbooks, acessos e ferramentas de cada um
//   node scripts/launch.mjs seed-tools                               grava as ferramentas de operação no catálogo (imphq_capabilities)
//   node scripts/launch.mjs kit --project slimsoda [--canais "youtube,seo,ads,x1"]
//                                                                    checklist de acessos (sem --canais: pelos playbooks aplicados)
//   node scripts/launch.mjs acesso --project slimsoda --acesso dominio --status conectado [--nota "..."] [--dono Bruno]
//
// Senha, token e chave nunca passam por aqui: só status, nota e dono.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ACCESS_BY_KEY, ACCESS_STATUS_LABEL, CHANNELS, OPS_TOOLS, accessChecklist, channelsFromPlaybooks, parseChannels } from "../supabase/functions/_shared/launch-kit.ts";

const WORK_DIR = ".tmp-launch";
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : null; };
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
const norm = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Evidência que o Império vê sozinho: WhatsApp ativo, gasto sincronizado (7 d), tracker (7 d), vendas pelo webhook (30 d). */
function evidence(projectId) {
  const [row] = query(`select
    exists (select 1 from imphq_wa_providers where project_id = ${q(projectId)} and is_active) as whatsapp,
    exists (select 1 from imphq_ads_spend where project_id = ${q(projectId)} and data_ref >= current_date - 7) as ads_sync,
    exists (select 1 from imphq_events where project_id = ${q(projectId)} and created_at > now() - interval '7 days') as tracker,
    exists (select 1 from imphq_vendas where project_id = ${q(projectId)} and created_at > now() - interval '30 days') as vendas`);
  return row ?? {};
}

switch (cmd) {
  case "canais": {
    for (const c of CHANNELS) {
      console.log(`\n${c.key} — ${c.label}\n  ${c.resumo}\n  playbooks: ${c.playbooks.join(", ")}\n  acessos: ${c.acessos.join(", ")}${c.opcionais.length ? ` (opcionais: ${c.opcionais.join(", ")})` : ""}\n  ferramentas: ${c.ferramentas.join(", ")}`);
    }
    break;
  }
  case "seed-tools": {
    const values = OPS_TOOLS.map((t) => `(${q(t.id)}, ${q(t.nome)}, ${q(t.url)}, ${q(t.categoria)}, ${q(t.quando_usar)}, array[${t.serve_para.map(q).join(", ")}]::text[], ${q(t.prioridade)}, 'kit de operação', true, now())`);
    const rows = query(`insert into imphq_capabilities (id, nome, url, categoria, quando_usar, serve_para, prioridade, fonte, ativo, updated_at)
      values ${values.join(",\n")}
      on conflict (id) do update set nome = excluded.nome, url = excluded.url, categoria = excluded.categoria, quando_usar = excluded.quando_usar,
        serve_para = excluded.serve_para, prioridade = excluded.prioridade, fonte = excluded.fonte, ativo = true, updated_at = now()
      returning id, categoria`);
    console.table(rows);
    break;
  }
  case "kit": {
    const projectId = need("project");
    const [proj] = query(`select id, name from imphq_projects where id = ${q(projectId)}`);
    if (!proj) throw new Error(`Projeto '${projectId}' não encontrado`);
    let canais;
    if (flag("canais")) {
      const parsed = parseChannels(flag("canais"));
      if (parsed.invalidos.length) console.warn(`Canais desconhecidos ignorados: ${parsed.invalidos.join(", ")} (veja: node scripts/launch.mjs canais)`);
      canais = parsed.canais;
    } else {
      canais = channelsFromPlaybooks(query(`select distinct playbook_id from imphq_playbook_applications where project_id = ${q(projectId)}`).map((r) => r.playbook_id));
    }
    if (!canais.length) { console.log("Nenhum canal: passe --canais ou aplique um playbook no projeto."); break; }
    const declared = query(`select access_key, status, nota, owner_member_id, updated_at from imphq_project_access where project_id = ${q(projectId)}`);
    const kit = accessChecklist(canais, declared, evidence(projectId));
    console.log(`\n${proj.name} — canais: ${canais.join(", ")} — obrigatórios prontos: ${kit.progresso}${kit.pronto_para_rodar ? " (pronto para rodar)" : ""}`);
    console.table(kit.itens.map((i) => ({ acesso: i.key, status: ACCESS_STATUS_LABEL[i.status], obrigatorio: i.obrigatorio ? "sim" : "", canais: i.canais.join(","), espera: i.bloqueado_por.join(","), aviso: i.aviso ?? "" })));
    if (kit.proximos.length) {
      console.log("Próximos (sem bloqueio):");
      for (const k of kit.proximos) console.log(`  - ${ACCESS_BY_KEY.get(k).label}: ${ACCESS_BY_KEY.get(k).como}`);
    }
    break;
  }
  case "acesso": {
    const projectId = need("project"), key = need("acesso"), status = need("status");
    if (!ACCESS_BY_KEY.has(key)) throw new Error(`Acesso '${key}' desconhecido. Chaves: ${[...ACCESS_BY_KEY.keys()].join(", ")}`);
    if (!(status in ACCESS_STATUS_LABEL)) throw new Error(`Status inválido. Use: ${Object.keys(ACCESS_STATUS_LABEL).join(", ")}`);
    let owner = null;
    if (flag("dono")) {
      const team = query("select id, name, email from imphq_team_members where coalesce(is_active, true)");
      const who = norm(flag("dono"));
      owner = team.find((m) => m.id === flag("dono") || norm(m.email) === who || norm(m.name) === who || norm(m.name).split(/\s+/)[0] === who);
      if (!owner) throw new Error(`Ninguém do time com '${flag("dono")}'`);
    }
    const rows = query(`insert into imphq_project_access (project_id, access_key, status, nota, owner_member_id, updated_by, updated_at)
      values (${q(projectId)}, ${q(key)}, ${q(status)}, ${q(flag("nota"))}, ${q(owner?.id ?? null)}, 'cli', now())
      on conflict (project_id, access_key) do update set status = excluded.status,
        nota = coalesce(excluded.nota, imphq_project_access.nota), owner_member_id = coalesce(excluded.owner_member_id, imphq_project_access.owner_member_id),
        updated_by = 'cli', updated_at = now()
      returning project_id, access_key, status, nota`);
    console.table(rows);
    break;
  }
  default:
    console.log("Uso: node scripts/launch.mjs canais | seed-tools | kit --project <id> [--canais ...] | acesso --project <id> --acesso <key> --status <status>");
}

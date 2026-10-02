#!/usr/bin/env node
// CLI da esteira de conteúdo (Story OP1.2). Fala com o banco pela CLI do Supabase (projeto linkado), como scripts/map-prints.mjs.
//
//   node scripts/content.mjs accounts [--project jp_freitas]
//   node scripts/content.mjs account:add --project jp_freitas --platform tiktok --handle @conta --env <id do aparelho GeeLark>
//        [--limit 1] [--link https://...] [--status aquecendo|ativo] [--fb-page "Nome da página"]
//   node scripts/content.mjs account:set --handle @conta --platform tiktok [--status ativo] [--limit 2] [--env <id>] [--link https://...]
//   node scripts/content.mjs add --project jp_freitas --title "..." --file video.mp4 [--caption "..."] [--hook "..."] [--angle "..."] [--batch lote-01]
//   node scripts/content.mjs batch lote-01
//   node scripts/content.mjs approve --batch lote-01            (ou --id <uuid>)
//   node scripts/content.mjs schedule --batch lote-01 --platform tiktok [--project jp_freitas] [--start 2026-10-03T12:00:00Z] [--gap 180]
//   node scripts/content.mjs status [--project jp_freitas]
//   node scripts/content.mjs run [--dry-run]                     (chama o geelark-publisher)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { planPosts } from "../supabase/functions/_shared/content-pipeline.ts";

const PROJECT_REF = "tkbivipqiewkfnhktmqq";
const BUCKET = "content-media";
const PUBLIC_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}`;
const WORK_DIR = ".tmp-content";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : null; };
const has = (name) => rest.includes(`--${name}`);
const need = (name) => { const v = flag(name); if (!v) { console.error(`Falta --${name}`); process.exit(1); } return v; };

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
function supabase(cliArgs) {
  return execFileSync(npx, ["supabase", ...cliArgs], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32",
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
}
let queryCount = 0;
function query(sql) {
  mkdirSync(WORK_DIR, { recursive: true });
  const file = join(WORK_DIR, `query-${++queryCount}.sql`);
  writeFileSync(file, sql);
  const out = supabase(["db", "query", "--linked", "--output-format", "json", "-f", file.split("\\").join("/")]);
  const parsed = JSON.parse(out.slice(out.indexOf("{")));
  return parsed.rows ?? [];
}
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const table = (rows, cols) => { if (!rows.length) { console.log("(nada)"); return; } console.table(rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])))); };

switch (cmd) {
  case "accounts": {
    const project = flag("project");
    table(query(`select project_id, platform, handle, status, daily_post_limit, geelark_env_id, link_url from imphq_social_accounts ${project ? `where project_id = ${q(project)}` : ""} order by project_id, platform, handle`),
      ["project_id", "platform", "handle", "status", "daily_post_limit", "geelark_env_id", "link_url"]);
    break;
  }
  case "account:add": {
    const fbPage = flag("fb-page");
    const rows = query(`insert into imphq_social_accounts (project_id, platform, handle, geelark_env_id, daily_post_limit, link_url, status, metadata)
      values (${q(need("project"))}, ${q(need("platform"))}, ${q(need("handle"))}, ${q(need("env"))}, ${Number(flag("limit") || 1)}, ${q(flag("link"))}, ${q(flag("status") || "aquecendo")},
      ${q(JSON.stringify(fbPage ? { facebook_page: fbPage } : {}))}::jsonb)
      returning id, platform, handle, status`);
    table(rows, ["id", "platform", "handle", "status"]);
    break;
  }
  case "account:set": {
    const sets = [];
    if (flag("status")) sets.push(`status = ${q(flag("status"))}`);
    if (flag("limit")) sets.push(`daily_post_limit = ${Number(flag("limit"))}`);
    if (flag("env")) sets.push(`geelark_env_id = ${q(flag("env"))}`);
    if (flag("link")) sets.push(`link_url = ${q(flag("link"))}`);
    if (!sets.length) { console.error("Nada para mudar (use --status, --limit, --env ou --link)"); process.exit(1); }
    table(query(`update imphq_social_accounts set ${sets.join(", ")}, updated_at = now() where handle = ${q(need("handle"))} and platform = ${q(need("platform"))} returning platform, handle, status, daily_post_limit`),
      ["platform", "handle", "status", "daily_post_limit"]);
    break;
  }
  case "add": {
    const file = need("file");
    if (!existsSync(file)) { console.error(`Arquivo não encontrado: ${file}`); process.exit(1); }
    const project = need("project");
    const objectName = `${randomUUID()}${extname(file).toLowerCase() || ".mp4"}`;
    // `storage cp` de pasta leva o nome da pasta para o caminho público: copia o arquivo para uma pasta com o nome do projeto.
    const dir = join(WORK_DIR, project);
    mkdirSync(dir, { recursive: true });
    copyFileSync(file, join(dir, objectName));
    supabase(["storage", "cp", join(dir, objectName).replace(/\\/g, "/"), `ss:///${BUCKET}/${project}/${objectName}`, "--linked", "--experimental", "--cache-control", "max-age=31536000"]);
    const mediaUrl = `${PUBLIC_BASE}/${project}/${objectName}`;
    const rows = query(`insert into imphq_content_items (project_id, title, caption, hook, angle, batch, media_url, status, source, metadata)
      values (${q(project)}, ${q(need("title"))}, ${q(flag("caption"))}, ${q(flag("hook"))}, ${q(flag("angle"))}, ${q(flag("batch"))}, ${q(mediaUrl)}, 'pronto', 'cli',
      ${q(JSON.stringify({ original_file: basename(file) }))}::jsonb)
      returning id, title, status, media_url`);
    table(rows, ["id", "title", "status", "media_url"]);
    break;
  }
  case "batch": {
    const name = rest[0];
    if (!name) { console.error("Uso: batch <nome-do-lote>"); process.exit(1); }
    table(query(`select i.id, i.title, i.status, count(p.id) postagens, count(p.id) filter (where p.status = 'publicado') publicadas
      from imphq_content_items i left join imphq_content_posts p on p.content_id = i.id where i.batch = ${q(name)} group by i.id order by i.created_at`),
      ["id", "title", "status", "postagens", "publicadas"]);
    break;
  }
  case "approve": {
    const where = flag("id") ? `id = ${q(flag("id"))}` : `batch = ${q(need("batch"))}`;
    table(query(`update imphq_content_items set status = 'aprovado', approved_at = now(), updated_at = now()
      where ${where} and status = 'pronto' and media_url is not null returning id, title, status`), ["id", "title", "status"]);
    break;
  }
  case "schedule": {
    const batch = need("batch");
    const platform = need("platform");
    const project = flag("project");
    const items = query(`select id, project_id from imphq_content_items where batch = ${q(batch)} and status = 'aprovado' order by created_at`);
    if (!items.length) { console.log("Nenhuma peça aprovada nesse lote."); break; }
    const projectId = project || items[0].project_id;
    const accounts = query(`select a.id, a.handle, a.daily_post_limit, coalesce(array_agg(p.content_id) filter (where p.id is not null), '{}') taken
      from imphq_social_accounts a left join imphq_content_posts p on p.account_id = a.id
      where a.project_id = ${q(projectId)} and a.platform = ${q(platform)} and a.status = 'ativo' group by a.id order by a.handle`);
    if (!accounts.length) { console.log(`Nenhuma conta ativa de ${platform} no projeto ${projectId}.`); break; }
    const start = flag("start") ? new Date(flag("start")) : new Date(Date.now() + 10 * 60_000);
    const plan = planPosts(items.map((i) => i.id), accounts.map((a) => ({ id: a.id, daily_post_limit: a.daily_post_limit, taken: a.taken || [] })), start, Number(flag("gap") || 180));
    if (!plan.length) { console.log("Nada novo para agendar."); break; }
    const values = plan.map((p) => `(${q(p.contentId)}, ${q(p.accountId)}, ${q(projectId)}, ${q(platform)}, ${q(p.scheduledAt.toISOString())})`).join(",\n");
    const rows = query(`insert into imphq_content_posts (content_id, account_id, project_id, platform, scheduled_at) values ${values}
      on conflict (content_id, account_id) do nothing returning id, scheduled_at`);
    console.log(`${rows.length} postagem(ns) agendada(s) em ${accounts.length} conta(s) de ${platform}.`);
    break;
  }
  case "status": {
    const project = flag("project");
    const filter = project ? `where p.project_id = ${q(project)}` : "";
    table(query(`select p.platform, p.status, count(*) n, min(p.scheduled_at) proxima from imphq_content_posts p ${filter} group by 1, 2 order by 1, 2`), ["platform", "status", "n", "proxima"]);
    const errors = query(`select a.handle, p.status, p.attempts, left(p.last_error, 120) erro from imphq_content_posts p join imphq_social_accounts a on a.id = p.account_id
      where p.last_error is not null ${project ? `and p.project_id = ${q(project)}` : ""} order by p.updated_at desc limit 10`);
    if (errors.length) { console.log("Últimos erros:"); table(errors, ["handle", "status", "attempts", "erro"]); }
    const blocked = query(`select platform, handle, status, left(notes, 100) motivo from imphq_social_accounts where status in ('pausado', 'bloqueado') ${project ? `and project_id = ${q(project)}` : ""}`);
    if (blocked.length) { console.log("Contas paradas:"); table(blocked, ["platform", "handle", "status", "motivo"]); }
    break;
  }
  case "run": {
    // A function exige um JWT válido no gateway; a chave pública do app basta, e o worker só processa o que já está aprovado e vencido.
    const env = readFileSync(".env", "utf8");
    const key = env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)"?/m)?.[1];
    if (!key) { console.error("VITE_SUPABASE_PUBLISHABLE_KEY não encontrada no .env"); process.exit(1); }
    const res = await fetch(`https://${PROJECT_REF}.supabase.co/functions/v1/geelark-publisher`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ dry_run: has("dry-run") }),
    });
    console.log(res.status, await res.text());
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//   ")).map((l) => l.slice(5)).join("\n"));
}

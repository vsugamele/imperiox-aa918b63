#!/usr/bin/env node
// Prints das páginas de cada etapa do mapa (computador e celular) → Storage `map-prints` → etapa.
//
// Uso:
//   node scripts/map-prints.mjs                      # todos os mapas não arquivados
//   node scripts/map-prints.mjs --map <map_id> ...   # só estes mapas
//   node scripts/map-prints.mjs --node <node_id> ... # só estas etapas
//   node scripts/map-prints.mjs --dry-run            # só lista o que faria
//
// Requisitos: projeto Supabase linkado no CLI (npx supabase link) e Chromium do Playwright instalado.
// Pixel, CAPI e trackers são bloqueados durante o print para não sujar os dados de anúncio.
// image_url da etapa só recebe o print quando estava vazio ou já era o print anterior (imagens postas à mão ficam).

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";

const PROJECT_REF = "tkbivipqiewkfnhktmqq";
const BUCKET = "map-prints";
const PUBLIC_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}`;
const WORK_DIR = ".tmp-prints";
const BLOCKED = /facebook\.(net|com)\/(tr|en_US|signals)|connect\.facebook|\/api\/track-capi|supabase\.co\/rest|clarity\.ms|googletagmanager|google-analytics|analytics\.tiktok|hotjar|doubleclick/i;
const SKIP_KINDS = new Set(["vertical", "area", "imagem"]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const mapIds = args.flatMap((a, i) => (a === "--map" && args[i + 1] ? [args[i + 1]] : []));
const nodeIds = args.flatMap((a, i) => (a === "--node" && args[i + 1] ? [args[i + 1]] : []));

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
function supabase(cliArgs) {
  return execFileSync(npx, ["supabase", ...cliArgs], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32",
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
}
let queryCount = 0;
function query(sql) {
  // SQL vai por arquivo: no Windows o shell quebra argumentos com várias linhas.
  mkdirSync(WORK_DIR, { recursive: true });
  const file = join(WORK_DIR, `query-${++queryCount}.sql`);
  writeFileSync(file, sql);
  const out = supabase(["db", "query", "--linked", "--output-format", "json", "-f", file.split("\\").join("/")]);
  const parsed = JSON.parse(out.slice(out.indexOf("{")));
  return parsed.rows ?? [];
}
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const mapFilter = mapIds.length
  ? `m.id in (${mapIds.map(q).join(",")})`
  : "m.archived_at is null";
const nodes = query(`
  select n.id, n.map_id, n.label, n.kind, n.url, n.image_url, n.print_meta
  from imphq_company_map_nodes n join imphq_company_maps m on m.id = n.map_id
  where ${mapFilter}${nodeIds.length ? ` and n.id in (${nodeIds.map(q).join(",")})` : ""} and n.url ~* '^https?://'
  order by n.map_id, n.label`).filter((n) => !SKIP_KINDS.has(n.kind));

console.log(`${nodes.length} etapa(s) com página para fotografar`);
if (dryRun) {
  for (const n of nodes) console.log(`- [${n.kind}] ${n.label} → ${n.url}`);
  process.exit(0);
}
if (!nodes.length) process.exit(0);

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const runDir = join(WORK_DIR, stamp);

const browser = await chromium.launch();
const profiles = {
  desktop: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
  mobile: { ...devices["iPhone 13"] },
};
const results = [];
for (const node of nodes) {
  const meta = { source_url: node.url, captured_at: new Date().toISOString(), status: "ok" };
  try {
    for (const [name, profile] of Object.entries(profiles)) {
      const context = await browser.newContext({ ...profile, locale: "en-US" });
      await context.route("**/*", (route) => (BLOCKED.test(route.request().url()) ? route.abort() : route.continue()));
      const page = await context.newPage();
      await page.goto(node.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(2_500);
      // Instagram abre um convite "veja no app" por cima do perfil; fecha antes do print.
      if (/instagram.com/i.test(node.url)) {
        await page.locator("svg[aria-label=\"Close\"], [aria-label=\"Close\"]").first().click({ timeout: 3_000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
      const rel = `${node.map_id}/${node.id}-${stamp}-${name}.jpg`;
      mkdirSync(join(runDir, node.map_id), { recursive: true });
      await page.screenshot({ path: join(runDir, rel), type: "jpeg", quality: 72 });
      // `storage cp -r <runDir>` leva a pasta da execução junto: o caminho público começa por ela.
      meta[name] = `${PUBLIC_BASE}/${stamp}/${rel}`;
      await context.close();
    }
    console.log(`ok   ${node.label}`);
  } catch (error) {
    meta.status = "error";
    meta.error = String(error?.message || error).slice(0, 300);
    console.log(`erro ${node.label}: ${meta.error}`);
  }
  results.push({ node, meta });
}
await browser.close();

const okCount = results.filter((r) => r.meta.status === "ok").length;
if (okCount) {
  console.log(`enviando ${okCount * 2} imagem(ns) para o Storage...`);
  supabase(["storage", "cp", "-r", runDir.replace(/\\/g, "/"), `ss:///${BUCKET}/`, "--linked", "--experimental", "--cache-control", "max-age=31536000", "-j", "4"]);
}

// image_url recebe o print só se estava vazio ou se era o print anterior.
const updates = results.map(({ node, meta }) => {
  const previous = node.print_meta?.desktop ?? null;
  const setImage = meta.status === "ok" && (!node.image_url || node.image_url === previous);
  return `update imphq_company_map_nodes set print_meta = ${q(JSON.stringify(meta))}::jsonb${setImage ? `, image_url = ${q(meta.desktop)}` : ""}, updated_at = now() where id = ${q(node.id)};`;
});
const sqlFile = join(WORK_DIR, `${stamp}.sql`);
writeFileSync(sqlFile, `begin;\n${updates.join("\n")}\ncommit;\n`);
supabase(["db", "query", "--linked", "-f", sqlFile.replace(/\\/g, "/")]);
rmSync(WORK_DIR, { recursive: true, force: true });

console.log(`pronto: ${okCount} etapa(s) com print, ${results.length - okCount} com erro (detalhe em print_meta.error)`);

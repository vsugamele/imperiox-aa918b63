#!/usr/bin/env node
// Sala de máquinas na CLI (Story OP1.3): saúde de rotinas, ações automáticas, webhooks, anúncios, chips, Instagram, voz,
// custo de IA, fontes por projeto e banco. Mesma regra da tela (_shared/machine-room.ts).
//
//   node scripts/health.mjs              alertas, do mais grave ao informativo
//   node scripts/health.mjs --erros      só erros e atenções
//   node scripts/health.mjs --json       retrato bruto + alertas em JSON (para IA/automação)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { alertCounts, machineAlerts } from "../supabase/functions/_shared/machine-room.ts";

const args = process.argv.slice(2);
const WORK_DIR = ".tmp-health";
mkdirSync(WORK_DIR, { recursive: true });
const file = join(WORK_DIR, "machine-room.sql");
writeFileSync(file, "select imphq_machine_room() r;");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const out = execFileSync(npx, ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file.split("\\").join("/")], {
  encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32", env: { ...process.env, MSYS_NO_PATHCONV: "1" },
});
const raw = JSON.parse(out.slice(out.indexOf("{"))).rows[0].r;
const room = typeof raw === "string" ? JSON.parse(raw) : raw;
const alerts = machineAlerts(room);

if (args.includes("--json")) {
  console.log(JSON.stringify({ room, alerts, counts: alertCounts(alerts) }, null, 2));
  process.exit(0);
}

const counts = alertCounts(alerts);
console.log(`Sala de máquinas — ${new Date(room.gerado_em).toLocaleString("pt-BR")}`);
console.log(`${counts.erro} erro(s) · ${counts.atencao} atenção · ${counts.info} informativo(s)\n`);
const icon = { erro: "✖", atencao: "▲", info: "·" };
for (const a of alerts) {
  if (args.includes("--erros") && a.severidade === "info") continue;
  console.log(`${icon[a.severidade]} [${a.area}] ${a.titulo}`);
  if (a.detalhe) console.log(`    ${a.detalhe.replace(/\s+/g, " ").slice(0, 220)}`);
  if (a.acao) console.log(`    → ${a.acao}`);
}
console.log(`\nRotinas ativas: ${room.rotinas.length} · banco: ${room.banco?.total_mb ?? "?"} MB (histórico das rotinas: ${room.banco?.historico_cron_mb ?? "?"} MB)`);

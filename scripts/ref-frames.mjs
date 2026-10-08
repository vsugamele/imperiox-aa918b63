#!/usr/bin/env node
// Quadros do storyboard das referências dissecadas (REF3.1). Para cada referência com análise e sem quadros:
// baixa o vídeo, tira 1 quadro (JPG 480px) em cada cena marcada pelo ref-dissect (analise.cenas) — ou 12 quadros
// espaçados quando não há cenas —, envia para o bucket público reference-frames e grava imphq_referencias.quadros.
// Também traz para o Storage os vídeos que estão só como link de rede social (yt-dlp), para o ref-dissect processar.
//
//   node scripts/ref-frames.mjs                 processa todas as pendentes
//   node scripts/ref-frames.mjs --limit 5       só as 5 primeiras
//   node scripts/ref-frames.mjs --social        baixa os vídeos de Instagram/Facebook/TikTok para o Storage
//
// Usa a CLI do Supabase logada (db query / storage cp --linked). Requer ffmpeg e ffprobe no PATH.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_REF = "tkbivipqiewkfnhktmqq";
const BUCKET = "reference-frames";
const PUBLIC_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}`;
const MEDIA_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/project-media`;
const WORK = ".tmp-ref-frames";
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 1000;
const social = args.includes("--social");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32" && cmd === npx, ...opts });
const supabase = (a) => run(npx, ["supabase", ...a], { env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

function sql(text) {
  mkdirSync(WORK, { recursive: true });
  const f = join(WORK, "q.sql");
  writeFileSync(f, text);
  const out = supabase(["db", "query", "--linked", "--output-format", "json", "-f", f.split("\\").join("/")]);
  return JSON.parse(out.slice(out.indexOf("{"))).rows ?? [];
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

function duration(file) {
  const out = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  const n = Number(out.trim());
  return Number.isFinite(n) ? n : null;
}

function grab(file, seconds, outFile) {
  run("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(seconds), "-i", file, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", outFile]);
  return existsSync(outFile);
}

async function socialToStorage() {
  const rows = sql(`select id, url from imphq_referencias where analise is null and url ~* '(instagram|facebook|fb\\.watch|tiktok)' and coalesce(image_url,'') !~ 'supabase\\.co/storage' limit ${limit};`);
  console.log(`${rows.length} vídeo(s) de rede social para trazer ao Storage.`);
  const dir = join(WORK, "social");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ok = [];
  for (const r of rows) {
    try {
      const cookiesIdx = args.indexOf("--cookies");
      const cookies = cookiesIdx >= 0 ? ["--cookies", args[cookiesIdx + 1]] : [];
      run("yt-dlp", ["-q", "--no-warnings", ...cookies, "-f", "mp4/best[ext=mp4]/best", "--max-filesize", "20M", "-o", join(dir, `${r.id}.%(ext)s`), r.url]);
      const f = readdirSync(dir).find((n) => n.startsWith(r.id));
      if (f) { ok.push({ id: r.id, file: f }); console.log(`  ok ${r.id}`); }
    } catch (e) { console.warn(`  falhou ${r.id}: ${String(e.message).split("\n")[0]}`); }
  }
  if (!ok.length) return;
  mkdirSync(join(WORK, "up", "referencias-social"), { recursive: true });
  for (const o of ok) writeFileSync(join(WORK, "up", "referencias-social", o.file), readFileSync(join(dir, o.file)));
  supabase(["storage", "cp", "-r", join(WORK, "up", "referencias-social").split("\\").join("/"), "ss:///project-media/", "--linked", "--experimental", "-j", "4"]);
  sql(ok.map((o) => `update imphq_referencias set image_url = ${q(`${MEDIA_BASE}/referencias-social/${o.file}`)}, tipo = 'video', updated_at = now() where id = ${q(o.id)};`).join("\n"));
  console.log(`${ok.length} vídeo(s) no Storage; o ref-dissect pega no próximo ciclo.`);
}

async function frames() {
  const rows = sql(`select id, coalesce(nullif(url,''), image_url) as src, url, image_url, duracao, analise->'cenas' as cenas
    from imphq_referencias
    where analise is not null and (quadros is null or jsonb_array_length(quadros) = 0)
    order by updated_at desc limit ${limit};`);
  console.log(`${rows.length} referência(s) dissecada(s) sem quadros.`);
  rmSync(join(WORK, "frames"), { recursive: true, force: true });
  const updates = [];
  for (const r of rows) {
    const src = [r.url, r.image_url].find((u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(String(u ?? ""))) ?? r.src;
    if (!src || !/^https?:/.test(src)) { console.warn(`  sem vídeo baixável: ${r.id}`); continue; }
    const vid = join(WORK, `${r.id}.mp4`);
    try {
      mkdirSync(WORK, { recursive: true });
      await download(src, vid);
      const dur = duration(vid) ?? Number(r.duracao) ?? 0;
      let marks = (Array.isArray(r.cenas) ? r.cenas : []).map((c) => Number(c.seconds)).filter((s) => Number.isFinite(s) && s >= 0);
      if (!marks.length && dur > 0) marks = Array.from({ length: 12 }, (_, i) => Math.round(((i + 0.5) * dur / 12) * 100) / 100);
      marks = marks.map((s) => Math.min(s, Math.max(0, dur - 0.15)));
      const dir = join(WORK, "frames", r.id);
      mkdirSync(dir, { recursive: true });
      const quadros = [];
      marks.forEach((s, i) => {
        const name = `q${String(i + 1).padStart(2, "0")}_${s.toFixed(2)}.jpg`;
        if (grab(vid, s, join(dir, name))) quadros.push({ seconds: s, url: `${PUBLIC_BASE}/dissect/${r.id}/${name}` });
      });
      if (quadros.length) { updates.push({ id: r.id, quadros, dur }); console.log(`  ${r.id}: ${quadros.length} quadros`); }
    } catch (e) {
      console.warn(`  falhou ${r.id}: ${String(e.message).split("\n")[0]}`);
    } finally { rmSync(vid, { force: true }); }
  }
  if (!updates.length) return;
  supabase(["storage", "cp", "-r", join(WORK, "frames").split("\\").join("/"), `ss:///${BUCKET}/dissect/`, "--linked", "--experimental", "--cache-control", "max-age=31536000", "-j", "6"]);
  for (let i = 0; i < updates.length; i += 20) {
    sql(updates.slice(i, i + 20).map((u) => `update imphq_referencias set quadros = ${q(JSON.stringify(u.quadros))}::jsonb,
      image_url = case when coalesce(image_url,'') = '' or image_url ~* '\\.(mp4|mov|webm|m4v)(\\?|$)' then ${q(u.quadros[0].url)} else image_url end,
      duracao = coalesce(duracao, ${u.dur || "null"}), updated_at = now() where id = ${q(u.id)};`).join("\n"));
  }
  console.log(`${updates.length} storyboard(s) gravado(s).`);
}

if (social) await socialToStorage();
else await frames();

#!/usr/bin/env node
// Carga única das referências analisadas do Centro de Comando para o Império (Story REF1.1).
// Decisões do Vinicius (04/10/2026): dados + 6 quadros copiados; vídeo fica no bucket do Centro (link temporário);
// sem sincronia — a mineração passa a ser do Império.
//
//   node scripts/import-centro-references.mjs --dry-run          lista o que entraria
//   node scripts/import-centro-references.mjs --only 1           carrega só 1 (validação)
//   node scripts/import-centro-references.mjs                    carrega todas
//
// A chave de serviço do Centro é lida do .env.local do dashboard dele, usada só para baixar os quadros e
// nunca é mostrada, gravada, logada nem commitada (autorização do Vinicius em 04/10).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CENTRO_DIR = "C:/Users/vsuga/Documents/ChatGPT/Automação de Postagem/dashboard";
const BATCHES = ["referencias-br-20260913", "referencias-br-20260914", "referencias-br-20260918", "referencias-20260928-storyboard", "referencias-br-20260929"];
const PROJECT_REF = "tkbivipqiewkfnhktmqq";
const BUCKET = "reference-frames";
const PUBLIC_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}`;
const WORK_DIR = ".tmp-centro";
const FRAMES_DIR = join(WORK_DIR, "centro");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? Number(args[onlyIdx + 1]) : null;

function centroEnv() {
  const env = readFileSync(join(CENTRO_DIR, ".env.local"), "utf8");
  const get = (name) => env.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m"))?.[1];
  const url = get("SUPABASE_AUTOMACAO_URL");
  const key = get("SUPABASE_AUTOMACAO_SECRET_KEY");
  if (!url || !key) throw new Error("SUPABASE_AUTOMACAO_URL / SUPABASE_AUTOMACAO_SECRET_KEY ausentes no .env.local do Centro");
  return { url: url.replace(/\/$/, ""), key };
}

function editorial() {
  const records = {};
  for (const f of ["reference-editorial.json", "reference-editorial-ken.json", "reference-editorial-lote20.json"]) {
    const p = join(CENTRO_DIR, "src/data", f);
    if (existsSync(p)) Object.assign(records, JSON.parse(readFileSync(p, "utf8")).records);
  }
  return records;
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
function supabase(cliArgs) {
  return execFileSync(npx, ["supabase", ...cliArgs], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
}
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;

const { url, key } = centroEnv();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const filter = `metadata->library->>batch=in.(${BATCHES.join(",")})`;
const res = await fetch(`${url}/rest/v1/automacao_postagem_content_references?select=id,title,creator,url,collected_at,metadata&${filter}`, { headers });
if (!res.ok) throw new Error(`Centro respondeu ${res.status} ao listar referências`);
let rows = (await res.json()).filter((r) => r.metadata?.library?.sha256 && r.metadata.library.video_key);
rows.sort((a, b) => a.metadata.library.batch.localeCompare(b.metadata.library.batch) || (a.metadata.library.ordinal ?? 0) - (b.metadata.library.ordinal ?? 0));
if (only) rows = rows.slice(0, only);
const ed = editorial();
console.log(`${rows.length} referência(s) do Centro; ${Object.keys(ed).length} fichas editoriais.`);

if (dryRun) {
  for (const r of rows) console.log(`- [${r.metadata.library.batch}] ${r.title} · ${(r.metadata.library.frames || []).length} quadros · editorial ${ed[r.metadata.library.sha256] ? "sim" : "não"}`);
  process.exit(0);
}

rmSync(WORK_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

const records = [];
let downloaded = 0;
for (const r of rows) {
  const m = r.metadata.library;
  const frames = [];
  for (const f of m.frames || []) {
    const name = f.key.split("/").pop();
    const resp = await fetch(`${url}/storage/v1/object/authenticated/${m.bucket}/${f.key}`, { headers });
    if (!resp.ok) { console.warn(`  quadro indisponível (${resp.status}): ${r.title} ${name}`); continue; }
    mkdirSync(join(FRAMES_DIR, m.sha256), { recursive: true });
    writeFileSync(join(FRAMES_DIR, m.sha256, name), Buffer.from(await resp.arrayBuffer()));
    frames.push({ seconds: f.seconds, url: `${PUBLIC_BASE}/centro/${m.sha256}/${name}` });
    downloaded++;
  }
  const transcript = (m.transcript || []).filter((s) => typeof s?.text === "string");
  const editorialRec = ed[m.sha256] || null;
  records.push({
    external_id: r.id,
    titulo: r.title || "Referência sem título",
    url: m.source_url || null,
    image_url: frames[0]?.url || null,
    lote: m.batch,
    duracao: m.duration_seconds ?? null,
    quadros: frames,
    transcricao: transcript.map((s) => s.text).join(" ").trim() || null,
    tags: [editorialRec?.primaryNiche, editorialRec?.format, m.angle_family].filter(Boolean),
    criador: r.creator || null,
    analise: {
      ordinal: m.ordinal ?? null, arquivo: m.source_filename ?? null, report: m.report ?? null, methods: m.methods ?? [],
      anatomy: m.anatomy ?? null, awareness_level: m.awareness_level ?? null, angle_lens: m.angle_lens ?? null, angle_family: m.angle_family ?? null,
      belief_shift: m.belief_shift ?? null, quality_score: m.quality_score ?? null, replication_prompt: m.replication_prompt ?? null,
      channel_dna: m.channel_dna ?? null, reviewed_at: m.reviewed_at ?? null, transcript, editorial: editorialRec, criador: r.creator || null,
      coletado_em: r.collected_at ?? null,
    },
    video_ref: { origem: "centro", bucket: m.bucket, key: m.video_key },
  });
}
console.log(`${downloaded} quadro(s) baixado(s).`);

if (downloaded) {
  supabase(["storage", "cp", "-r", FRAMES_DIR.replace(/\\/g, "/"), `ss:///${BUCKET}/`, "--linked", "--experimental", "--cache-control", "max-age=31536000", "-j", "6"]);
  console.log("Quadros enviados ao bucket reference-frames.");
}

const values = records.map((x) => `(${q(`centro-${x.external_id}`)}, null, 'video', ${q(x.titulo)}, ${q(x.url)}, ${q(x.image_url)}, ${x.tags.length ? `array[${x.tags.map(q).join(",")}]::text[]` : "'{}'::text[]"}, ${q(x.criador ? `@${x.criador}` : null)}, ${q(`Centro — ${x.lote}`)}, ${q(x.transcricao)}, 'centro', ${q(x.external_id)}, ${q(x.lote)}, ${x.duracao ?? "null"}, ${j(x.quadros)}, ${j(x.analise)}, ${j(x.video_ref)}, 'instagram')`).join(",\n");
const sql = `insert into imphq_referencias (id, project_id, tipo, titulo, url, image_url, tags, notas, pasta, transcricao, fonte, external_id, lote, duracao, quadros, analise, video_ref, plataforma)
values ${values}
on conflict (external_id) where external_id is not null do update set
  titulo = excluded.titulo, url = excluded.url, image_url = excluded.image_url, tags = excluded.tags, notas = excluded.notas, pasta = excluded.pasta,
  transcricao = excluded.transcricao, lote = excluded.lote, duracao = excluded.duracao, quadros = excluded.quadros, analise = excluded.analise,
  video_ref = excluded.video_ref, updated_at = now()
returning id;`;
writeFileSync(join(WORK_DIR, "upsert.sql"), sql);
const out = supabase(["db", "query", "--linked", "--output-format", "json", "-f", join(WORK_DIR, "upsert.sql").split("\\").join("/")]);
const inserted = JSON.parse(out.slice(out.indexOf("{"))).rows?.length ?? 0;
console.log(`${inserted} referência(s) gravada(s) em imphq_referencias.`);

#!/usr/bin/env node
// Carga única dos perfis (personas) do Centro de Comando para imphq_profiles (Story OPS2.2).
// Mesma regra de leitura da tabela de contas do Centro (registro manual salvo vence o cadastro original).
// A chave de serviço do Centro é lida do .env.local dele e nunca é mostrada, gravada, logada nem commitada.
//
//   node scripts/import-centro-profiles.mjs --dry-run
//   node scripts/import-centro-profiles.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CENTRO_DIR = "C:/Users/vsuga/Documents/ChatGPT/Automação de Postagem/dashboard";
const WORK_DIR = ".tmp-centro";
const PRODUCT_TO_PROJECT = { "memoflow": "memoflow", "slim soda": "slimsoda", "slimsoda": "slimsoda", "leaftide": "leaftide", "cardioflush": "cardioflush" };
const STATUS = { inventory: "inventario", warming: "aquecendo", active: "ativo", paused: "pausado", blocked: "bloqueado" };
const CHANNELS = ["instagram", "facebook", "tiktok", "youtube"];

const env = readFileSync(join(CENTRO_DIR, ".env.local"), "utf8");
const get = (n) => env.match(new RegExp(`^${n}="?([^"\\r\\n]+)"?`, "m"))?.[1];
const url = get("SUPABASE_AUTOMACAO_URL")?.replace(/\/$/, "");
const key = get("SUPABASE_AUTOMACAO_SECRET_KEY");
if (!url || !key) throw new Error("Credenciais do Centro ausentes no .env.local");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const txt = (v) => (typeof v === "string" ? v.trim() : "");

const [profilesRes, productsRes] = await Promise.all([
  fetch(`${url}/rest/v1/automacao_postagem_profiles?select=id,product_id,editorial_name,status,warmup_status,publication_authorized,email_ref,instagram_ref,facebook_ref,facebook_type,geelark_phone_id,metadata,updated_at`, { headers }),
  fetch(`${url}/rest/v1/automacao_postagem_products?select=id,name`, { headers }),
]);
if (!profilesRes.ok || !productsRes.ok) throw new Error(`Centro respondeu ${profilesRes.status}/${productsRes.status}`);
const profiles = await profilesRes.json();
const products = new Map((await productsRes.json()).map((p) => [p.id, p.name]));

const rows = profiles.map((p) => {
  const meta = obj(p.metadata);
  const saved = obj(obj(meta.manual_registry).value);
  const refs = { instagram: p.instagram_ref, facebook: p.facebook_type === "page" ? "" : p.facebook_ref, tiktok: meta.tiktok_ref, youtube: meta.youtube_ref };
  const canais = Object.fromEntries(CHANNELS.map((c) => {
    const e = obj(obj(saved.channels)[c]);
    return [c, { ref: txt(e.reference ?? refs[c]) || null, status: txt(e.status) || "unknown" }];
  }));
  const originalPages = Array.isArray(meta.facebook_pages) ? meta.facebook_pages : [];
  const pageSource = Array.isArray(saved.pages) ? saved.pages : [...originalPages, ...(p.facebook_type === "page" && p.facebook_ref ? [p.facebook_ref] : [])];
  const paginas = pageSource.map((v) => ({ nome: txt(obj(v).name) || null, ref: typeof v === "string" ? v : txt(obj(v).reference ?? obj(v).url ?? obj(v).external_id) || null, status: txt(obj(v).status) || "unknown" }));
  const produto = products.get(p.product_id) ?? null;
  return {
    external_id: p.id, nome: p.editorial_name, produto,
    project_id: produto ? PRODUCT_TO_PROJECT[produto.toLowerCase()] ?? null : null,
    email: txt(saved.email ?? p.email_ref) || null, maquina: txt(saved.machine ?? p.geelark_phone_id) || null, proxy: txt(saved.proxy) || null,
    status: STATUS[p.status] ?? "inventario", aquecimento: p.warmup_status ?? null, publicacao_autorizada: !!p.publication_authorized,
    canais, paginas,
  };
});

if (process.argv.includes("--dry-run")) {
  for (const r of rows) console.log(`- ${r.nome} · ${r.produto ?? "sem produto"} → ${r.project_id ?? "sem projeto"} · ${r.status} · canais ${CHANNELS.filter((c) => r.canais[c].ref).join(",") || "nenhum"} · ${r.paginas.length} página(s)`);
  process.exit(0);
}

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
const values = rows.map((r) => `(${q(r.nome)}, ${q(r.project_id)}, ${q(r.email)}, ${q(r.maquina)}, ${q(r.proxy)}, ${q(r.status)}, ${q(r.aquecimento)}, ${r.publicacao_autorizada}, ${j(r.canais)}, ${j(r.paginas)}, 'centro', ${q(r.external_id)}, ${j({ produto_centro: r.produto })})`).join(",\n");
mkdirSync(WORK_DIR, { recursive: true });
const sqlFile = join(WORK_DIR, "profiles.sql");
writeFileSync(sqlFile, `insert into imphq_profiles (nome, project_id, email, maquina, proxy, status, aquecimento, publicacao_autorizada, canais, paginas_facebook, fonte, external_id, metadata)
values ${values}
on conflict (external_id) do update set nome = excluded.nome, project_id = excluded.project_id, email = excluded.email, maquina = excluded.maquina,
  proxy = excluded.proxy, status = excluded.status, aquecimento = excluded.aquecimento, publicacao_autorizada = excluded.publicacao_autorizada,
  canais = excluded.canais, paginas_facebook = excluded.paginas_facebook, metadata = excluded.metadata, updated_at = now()
returning id;`);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const out = execFileSync(npx, ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", sqlFile.split("\\").join("/")], { encoding: "utf8", shell: process.platform === "win32", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
console.log(`${JSON.parse(out.slice(out.indexOf("{"))).rows?.length ?? 0} perfil(is) gravado(s) em imphq_profiles.`);

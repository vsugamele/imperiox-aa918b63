// Elenco (OPS1.5). Sem cron: roda quando alguém pede (aba Elenco no Studio ou MCP).
//   modo "listar"  { project_id }                       → elenco do projeto
//   modo "sugerir" { project_id, produto?, publico?, contexto?, quantidade?, salvar? } → a IA propõe persona(s) do
//                  público + elenco visual variado; com salvar=true grava (origem "ia", sem fotos ainda)
//   modo "fotos"   { avatar_id, quantidade? }            → gera na Kie um retrato base e variações da MESMA pessoa
//                  (usando o retrato como referência), grava no bucket avatar-refs e anexa às fotos do avatar.
// Anti-loop: até 5 fotos por chamada, para após 3 falhas seguidas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { castFromRows, castSuggestPrompt, parseCastSuggestion, photoRefs, portraitPrompts, type CastRow } from "../_shared/cast.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
const KIE_MODEL = "nano-banana-pro";
const BUCKET = "avatar-refs";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Sb = ReturnType<typeof makeClient>;
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

async function kieImage(prompt: string, refs: string[]): Promise<string | null> {
  if (!KIE_API_KEY) return null;
  const r = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST", headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: KIE_MODEL, input: { prompt, image_input: refs.slice(0, 4), aspect_ratio: "4:5", resolution: "2K", output_format: "jpg" } }),
  });
  const d = await r.json().catch(() => ({}));
  const taskId = d?.data?.taskId || d?.taskId;
  if (!r.ok || !taskId) return null;
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 6000));
    const q = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${KIE_API_KEY}` } });
    const qd = (await q.json().catch(() => ({})))?.data ?? {};
    const status = String(qd.state || qd.status || "").toLowerCase();
    let parsed: { resultUrls?: string[] } | null = null;
    try { parsed = qd.resultJson ? JSON.parse(qd.resultJson) : null; } catch { parsed = null; }
    const url = parsed?.resultUrls?.[0] || qd.resultUrls?.[0];
    if (url && (status === "success" || status === "succeeded" || !status)) return url;
    if (status === "fail" || status === "failed") return null;
  }
  return null;
}

/** Baixa da Kie (link expira) e guarda no bucket privado; devolve o registro de foto no formato do Avatar Studio. */
async function store(sb: Sb, avatarId: string, url: string, n: number): Promise<{ path: string; url: string } | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());
  const path = `${avatarId}/ia-${Date.now()}-${n}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: r.headers.get("content-type") || "image/jpeg", upsert: true });
  if (error) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
  return { path, url: data?.signedUrl ?? "" };
}

async function generatePhotos(avatarId: string, quantidade: number) {
  const sb = makeClient();
  const { data: row } = await sb.from("imphq_avatar_studio_projects").select("id, nome, tipo, papel, ficha, avatar_photos, ativo").eq("id", avatarId).maybeSingle();
  if (!row) return;
  const [m] = castFromRows([row as CastRow]);
  const ficha = { ...(m.ficha as Record<string, unknown>) };
  const setStatus = (s: Record<string, unknown> | null) => sb.from("imphq_avatar_studio_projects").update({ ficha: s ? { ...ficha, _fotos: s } : ficha, updated_at: new Date().toISOString() }).eq("id", avatarId);
  await setStatus({ status: "gerando", em: new Date().toISOString() });
  const fotos = photoRefs(row.avatar_photos);
  const prompts = portraitPrompts(m, quantidade);
  const erros: string[] = [];
  let falhas = 0;

  // Rosto de referência: a primeira foto que já existe, ou um retrato base novo.
  let refUrl: string | null = null;
  if (fotos.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(fotos[0].path, 60 * 60);
    refUrl = data?.signedUrl ?? (fotos[0].url || null);
  } else {
    const url = await kieImage(prompts.base, []);
    const saved = url ? await store(sb, avatarId, url, 0) : null;
    if (saved) { fotos.push(saved); refUrl = saved.url; } else { erros.push("retrato base"); falhas++; }
  }
  for (const [i, p] of prompts.variacoes.entries()) {
    if (falhas >= 3 || !refUrl) break;
    const url = await kieImage(p, [refUrl]);
    const saved = url ? await store(sb, avatarId, url, i + 1) : null;
    if (saved) { fotos.push(saved); falhas = 0; } else { erros.push(`variação ${i + 1}`); falhas++; }
    await sb.from("imphq_avatar_studio_projects").update({ avatar_photos: fotos }).eq("id", avatarId);
  }
  await sb.from("imphq_avatar_studio_projects").update({ avatar_photos: fotos }).eq("id", avatarId);
  await setStatus(erros.length ? { status: "parcial", erros, em: new Date().toISOString() } : null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = String(body?.modo ?? "listar");
    const sb = makeClient();

    if (modo === "listar") {
      if (!body?.project_id) return json({ error: "project_id é obrigatório" }, 400);
      const { data, error } = await sb.from("imphq_avatar_studio_projects").select("id, nome, tipo, papel, ficha, avatar_photos, ativo").eq("project_id", String(body.project_id)).order("created_at");
      if (error) throw error;
      return json({ ok: true, elenco: castFromRows((data ?? []) as CastRow[]) });
    }

    if (modo === "sugerir") {
      if (!body?.project_id) return json({ error: "project_id é obrigatório" }, 400);
      if (!OPENROUTER_API_KEY) return json({ error: "OPENROUTER_API_KEY ausente" }, 500);
      const { data: proj } = await sb.from("imphq_projects").select("name, description").eq("id", String(body.project_id)).maybeSingle();
      const p = (proj ?? {}) as { name?: string; description?: string | null };
      const { system, user } = castSuggestPrompt({ projeto: p.name ?? String(body.project_id), produto: body.produto ?? null, publico: body.publico ?? null, contexto: body.contexto ?? p.description ?? null, quantidade: Number(body.quantidade) || 5 });
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Imperio HQ cast-studio" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const d = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
      const avatares = parseCastSuggestion(d.choices?.[0]?.message?.content ?? "");
      if (!avatares.length) return json({ error: "a IA não devolveu um elenco válido; tente de novo" }, 502);
      if (body?.salvar !== true) return json({ ok: true, avatares });
      const { data: saved, error } = await sb.from("imphq_avatar_studio_projects").insert(avatares.map((a) => ({
        project_id: String(body.project_id), nome: a.nome, tipo: a.tipo, papel: a.papel, ficha: a.ficha, origem: "ia",
        descricao: [a.ficha.idade ? `${a.ficha.idade} anos` : null, a.ficha.aparencia].filter(Boolean).join(" · ") || null,
      }))).select("id, nome, tipo, papel");
      if (error) throw new Error(error.message);
      return json({ ok: true, salvos: saved });
    }

    if (modo === "fotos") {
      if (!body?.avatar_id) return json({ error: "avatar_id é obrigatório" }, 400);
      if (!KIE_API_KEY) return json({ error: "KIE_API_KEY ausente" }, 500);
      const quantidade = Math.max(1, Math.min(5, Number(body.quantidade) || 4));
      const job = generatePhotos(String(body.avatar_id), quantidade).catch((e) => console.error("[cast-studio] fotos", e));
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(job);
      return json({ ok: true, gerando: quantidade, aviso: "Leva de 1 a 5 minutos; as fotos aparecem no avatar conforme ficam prontas." });
    }

    return json({ error: "modo deve ser listar, sugerir ou fotos" }, 400);
  } catch (e) {
    console.error("[cast-studio]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

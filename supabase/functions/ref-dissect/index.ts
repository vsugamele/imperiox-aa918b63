// Dissecador de Referências (REF3.1). Cron a cada 10 min: pega vídeos da biblioteca sem análise, manda o vídeo para o
// Gemini (OpenRouter) e grava a dissecação em imphq_referencias.analise (mesmo formato das análises do Centro).
// Os quadros do storyboard saem depois, em scripts/ref-frames.mjs (ffmpeg), nas cenas que o modelo marcou.
// body: { limite?: 1-4, id?: string }. 3 tentativas por vídeo; para o lote depois de 3 falhas seguidas do provedor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { DISSECT_MODEL, dissectMessages, MAX_DISSECT_BYTES, MAX_DISSECT_TENTATIVAS, parseDissecacao, storageObject } from "../_shared/ref-dissect.ts";
import { installAiUsageTracking } from "../_shared/ai-usage.ts";
// Custo por automação (OP1.4): registra cada chamada de IA desta function em imphq_ai_usage.
installAiUsageTracking("ref-dissect");

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const makeClient = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
type Sb = ReturnType<typeof makeClient>;
interface Ref { id: string; titulo: string | null; tipo: string | null; url: string | null; image_url: string | null; transcricao: string | null; pipeline: unknown }

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function openrouter(messages: unknown[]) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`, "Content-Type": "application/json", "X-Title": "Imperio HQ ref-dissect" },
    body: JSON.stringify({ model: DISSECT_MODEL, messages, temperature: 0.2, response_format: { type: "json_object" } }),
  });
  if (!r.ok) return { ok: false as const, status: r.status, error: (await r.text()).slice(0, 300) };
  const d = await r.json();
  return { ok: true as const, text: String(d?.choices?.[0]?.message?.content ?? "") };
}

const tentativas = (r: Ref) => Number(obj(obj(r.pipeline).dissecar).tentativas ?? 0);
const videoUrl = (r: Ref) => [r.url, r.image_url].find((u) => storageObject(u) && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(String(u))) ?? [r.url, r.image_url].find((u) => storageObject(u)) ?? null;

async function mark(sb: Sb, r: Ref, patch: Record<string, unknown>, result: Record<string, unknown>) {
  const pipeline = { ...obj(r.pipeline), dissecar: { tentativas: tentativas(r) + 1, ...result, em: new Date().toISOString() } };
  await sb.from("imphq_referencias").update({ ...patch, pipeline, pipeline_at: new Date().toISOString() }).eq("id", r.id);
}

async function dissecar(sb: Sb, r: Ref) {
  const src = storageObject(videoUrl(r));
  if (!src) { await mark(sb, r, {}, { erro: "vídeo fora do Storage", tentativas: MAX_DISSECT_TENTATIVAS }); return { id: r.id, ok: false, erro: "sem_video" }; }
  const { data: blob, error } = await sb.storage.from(src.bucket).download(src.path);
  if (error || !blob) { await mark(sb, r, {}, { erro: `download: ${error?.message ?? "vazio"}` }); return { id: r.id, ok: false, erro: "download" }; }
  if (blob.size > MAX_DISSECT_BYTES) {
    await mark(sb, r, {}, { erro: `vídeo grande (${Math.round(blob.size / 1048576)} MB)`, tentativas: MAX_DISSECT_TENTATIVAS });
    return { id: r.id, ok: false, erro: "grande" };
  }
  const dataUrl = `data:${blob.type || "video/mp4"};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
  const ctx = { titulo: r.titulo, transcricao: r.transcricao };
  let res = await openrouter(dissectMessages(dataUrl, "video_url", ctx));
  if (!res.ok && res.status === 400) res = await openrouter(dissectMessages(dataUrl, "image_url", ctx));
  if (!res.ok) { await mark(sb, r, {}, { erro: `${res.status}: ${res.error}` }); return { id: r.id, ok: false, erro: res.status, provider: true }; }
  const d = parseDissecacao(res.text);
  if (!d) { await mark(sb, r, {}, { erro: "resposta sem JSON válido" }); return { id: r.id, ok: false, erro: "json" }; }
  const { duracao, ...rest } = d;
  const analise = { ...rest, origem: "ref-dissect", modelo: DISSECT_MODEL, dissecado_em: new Date().toISOString() };
  const patch: Record<string, unknown> = { analise };
  if (duracao) patch.duracao = duracao;
  if (!String(r.transcricao ?? "").trim() && d.transcript.length) {
    Object.assign(patch, { transcricao: d.transcript.map((s) => s.text).join(" "), transcribe_status: "done", transcribe_provider: "openrouter:dissect", transcribed_at: new Date().toISOString() });
  }
  await mark(sb, r, patch, { feito: true, blocos: d.anatomy.blocks.length, cenas: d.cenas.length });
  return { id: r.id, ok: true, blocos: d.anatomy.blocks.length, cenas: d.cenas.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!Deno.env.get("OPENROUTER_API_KEY")) return json({ ok: false, error: "OPENROUTER_API_KEY ausente" }, 503);
  const body = obj(await req.json().catch(() => ({})));
  const limite = Math.max(1, Math.min(4, Number(body.limite ?? 2)));
  const sb = makeClient();
  const cols = "id, titulo, tipo, url, image_url, transcricao, pipeline";
  let q = sb.from("imphq_referencias").select(cols).is("analise", null);
  q = typeof body.id === "string" ? q.eq("id", body.id) : q.or("tipo.eq.video,url.ilike.%.mp4%").order("created_at", { ascending: false }).limit(200);
  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);
  const fila = ((data ?? []) as Ref[]).filter((r) => tentativas(r) < MAX_DISSECT_TENTATIVAS && videoUrl(r)).slice(0, limite);
  // Um vídeo por vez: vários vídeos em base64 ao mesmo tempo estouram a memória do worker.
  const resultados: unknown[] = [];
  for (const r of fila) resultados.push(await dissecar(sb, r).catch((e) => ({ id: r.id, ok: false, erro: e instanceof Error ? e.message : String(e) })));
  const pendentes = ((data ?? []) as Ref[]).filter((r) => tentativas(r) < MAX_DISSECT_TENTATIVAS && videoUrl(r)).length - fila.length;
  return json({ ok: true, processados: resultados, pendentes: Math.max(0, pendentes) });
});

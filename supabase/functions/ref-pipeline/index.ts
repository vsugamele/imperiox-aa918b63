// Pipeline de referências (REF2.1): guarda a mídia em link permanente, transcreve vídeo e lê imagem (OpenRouter,
// Gemini com visão), registra formato e nicho, e etiqueta o projeto com o Jev. O ângulo vem depois, no jev-classify.
// Cron a cada 10 min. Lotes pequenos; 3 tentativas por passo; para após 3 falhas seguidas de um provedor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  attempts, imageReadMessages, nextStep, parseLeitura, parseProject, projectNicho, projectRequest, videoReadMessages,
  type Leitura, type PipelineStep, type ProjectOption, type RefRow,
} from "../_shared/ref-pipeline.ts";
import { installAiUsageTracking } from "../_shared/ai-usage.ts";
// Custo por automação (OP1.4): registra cada chamada de IA desta function em imphq_ai_usage.
installAiUsageTracking("ref-pipeline");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const TYPESAFE_API_KEY = Deno.env.get("TYPESAFE_API_KEY");
const VISION_MODEL = "google/gemini-2.5-flash";
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Sb = ReturnType<typeof makeClient>;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function openrouter(messages: unknown[]): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Imperio HQ ref-pipeline" },
    body: JSON.stringify({ model: VISION_MODEL, messages, temperature: 0 }),
  });
  if (!r.ok) return { ok: false, status: r.status, error: (await r.text()).slice(0, 300) };
  const d = await r.json();
  return { ok: true, text: String(d?.choices?.[0]?.message?.content ?? "") };
}

async function mark(sb: Sb, ref: RefRow, step: PipelineStep, patch: Record<string, unknown>, result: Record<string, unknown>) {
  const pipeline = { ...obj(ref.pipeline), [step]: { ...obj(obj(ref.pipeline)[step]), tentativas: attempts(ref, step) + 1, ...result, em: new Date().toISOString() } };
  await sb.from("imphq_referencias").update({ ...patch, pipeline, pipeline_at: new Date().toISOString() }).eq("id", ref.id);
}

function leituraPatch(l: Leitura, provider: string) {
  return {
    transcricao: l.texto, transcribe_status: "done", transcribe_provider: provider, transcribe_error: null, transcribed_at: new Date().toISOString(),
    formato: l.formato, leitura: { nicho: l.nicho, gancho: l.gancho, descricao_visual: l.descricao_visual, texto_na_tela: l.texto_na_tela, modelo: VISION_MODEL },
  };
}

/** Link assinado expira: copia a imagem para o bucket público project-media e troca o link. */
async function guardarMidia(sb: Sb, ref: RefRow) {
  const src = String(ref.image_url);
  const res = await fetch(src);
  if (!res.ok) { await mark(sb, ref, "guardar_midia", {}, { erro: `download ${res.status}` }); return { ok: false, erro: `download ${res.status}` }; }
  const type = res.headers.get("content-type") || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const path = `referencias/${ref.id}.${ext}`;
  const { error } = await sb.storage.from("project-media").upload(path, new Uint8Array(await res.arrayBuffer()), { contentType: type, upsert: true });
  if (error) { await mark(sb, ref, "guardar_midia", {}, { erro: error.message }); return { ok: false, erro: error.message }; }
  const { data } = sb.storage.from("project-media").getPublicUrl(path);
  await mark(sb, ref, "guardar_midia", { image_url: data.publicUrl }, { feito: true, de: src.split("?")[0] });
  return { ok: true };
}

async function lerImagem(sb: Sb, ref: RefRow) {
  const r = await openrouter(imageReadMessages(String(ref.image_url)));
  if (!r.ok) { await mark(sb, ref, "ler_imagem", {}, { erro: `${r.status}: ${r.error}` }); return { ok: false, erro: r.status }; }
  const l = parseLeitura(r.text, "imagem");
  if (!l) { await mark(sb, ref, "ler_imagem", {}, { erro: "resposta sem JSON legível" }); return { ok: false, erro: "json" }; }
  await mark(sb, ref, "ler_imagem", leituraPatch(l, "openrouter:vision"), { feito: true });
  return { ok: true, formato: l.formato };
}

async function transcreverVideo(sb: Sb, ref: RefRow) {
  const res = await fetch(String(ref.url));
  if (!res.ok) { await mark(sb, ref, "transcrever_video", {}, { erro: `download ${res.status}` }); return { ok: false, erro: `download ${res.status}` }; }
  const size = Number(res.headers.get("content-length") || 0);
  if (size > MAX_VIDEO_BYTES) {
    await mark(sb, ref, "transcrever_video", {}, { erro: `vídeo grande (${Math.round(size / 1048576)} MB)`, tentativas: 3 });
    return { ok: false, erro: "grande" };
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const dataUrl = `data:${res.headers.get("content-type") || "video/mp4"};base64,${toBase64(bytes)}`;
  let r = await openrouter(videoReadMessages(dataUrl, "video_url"));
  if (!r.ok && r.status === 400) r = await openrouter(videoReadMessages(dataUrl, "image_url"));
  if (!r.ok) { await mark(sb, ref, "transcrever_video", { transcribe_status: "error", transcribe_error: `${r.status}` }, { erro: `${r.status}: ${r.error}` }); return { ok: false, erro: r.status }; }
  const l = parseLeitura(r.text, "video");
  if (!l) { await mark(sb, ref, "transcrever_video", {}, { erro: "resposta sem JSON legível" }); return { ok: false, erro: "json" }; }
  await mark(sb, ref, "transcrever_video", leituraPatch(l, "openrouter:video"), { feito: true });
  return { ok: true, formato: l.formato };
}

async function etiquetarProjeto(sb: Sb, ref: RefRow, projects: ProjectOption[]) {
  const r = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(projectRequest(String(ref.transcricao), projects)),
  });
  if (!r.ok) { await mark(sb, ref, "projeto", {}, { erro: `jev ${r.status}` }); return { ok: false, erro: r.status }; }
  const v = parseProject(await r.json());
  await mark(sb, ref, "projeto", v.project_id ? { project_id: v.project_id } : {}, { feito: true, sugestao: v.project_id, confianca: v.confianca });
  return { ok: true, projeto: v.project_id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!OPENROUTER_API_KEY) return json({ error: "OPENROUTER_API_KEY ausente" }, 500);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const lim = {
      guardar_midia: Math.min(20, Number(body?.limite_midia ?? 10)),
      ler_imagem: Math.min(20, Number(body?.limite_imagens ?? 8)),
      transcrever_video: Math.min(5, Number(body?.limite_videos ?? 2)),
      projeto: Math.min(30, Number(body?.limite_projetos ?? 15)),
    } as Record<PipelineStep, number>;
    const sb = makeClient();

    const { data: rows, error } = await sb.from("imphq_referencias")
      .select("id, tipo, url, image_url, project_id, transcricao, transcribe_status, duracao, pipeline")
      .order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    const fila: Record<PipelineStep, RefRow[]> = { guardar_midia: [], ler_imagem: [], transcrever_video: [], projeto: [] };
    for (const r of (rows ?? []) as RefRow[]) {
      const s = nextStep(r);
      if (s && fila[s].length < lim[s]) fila[s].push(r);
    }

    const { data: projs } = await sb.from("imphq_projects").select("id, name, data");
    const projects: ProjectOption[] = (projs ?? []).filter((p: { id: string }) => p.id).map((p: { id: string; name: string | null; data: unknown }) => ({ id: p.id, name: p.name ?? p.id, nicho: projectNicho(p.data, p.name ?? p.id) }));

    const out: Record<string, unknown[]> = { guardar_midia: [], ler_imagem: [], transcrever_video: [], projeto: [] };
    const run = async (step: PipelineStep, fn: (r: RefRow) => Promise<Record<string, unknown>>) => {
      let falhas = 0;
      for (const r of fila[step]) {
        if (falhas >= 3) { out[step].push({ parou: "3 falhas seguidas" }); break; }
        try {
          const res = await fn(r);
          falhas = res.ok ? 0 : falhas + 1;
          out[step].push({ id: r.id, ...res });
        } catch (e) { falhas++; out[step].push({ id: r.id, erro: e instanceof Error ? e.message : String(e) }); }
      }
    };
    await run("guardar_midia", (r) => guardarMidia(sb, r));
    await Promise.all([
      run("ler_imagem", (r) => lerImagem(sb, r)),
      run("transcrever_video", (r) => transcreverVideo(sb, r)),
      TYPESAFE_API_KEY ? run("projeto", (r) => etiquetarProjeto(sb, r, projects)) : Promise.resolve(),
    ]);
    const resumo = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { feitos: v.filter((x) => (x as { ok?: boolean }).ok).length, total: v.length }]));
    return json({ ok: true, resumo, detalhes: out });
  } catch (e) {
    console.error("[ref-pipeline]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

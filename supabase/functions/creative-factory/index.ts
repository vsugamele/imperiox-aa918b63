import { z } from "https://esm.sh/zod@3.25.76";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
function makeClient(url: string, key: string) { return createClient(url, key); }
const requestSchema = z.object({ action: z.string().nullish(), project_id: z.string().nullish(), nome: z.string().nullish(), briefing: z.unknown().optional(), referencias_urls: z.array(z.string()).nullish(), expert_fotos: z.array(z.string()).nullish(), angulos: z.array(z.string()).nullish(), formato: z.string().nullish(), asset_id: z.string().nullish(), instruction: z.string().nullish(), image_provider: z.string().nullish(), asset_ids: z.array(z.string()).nullish() }).passthrough();
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

type ImageProvider = "lovable-gemini" | "openai-image";

// Map our square/vertical/horizontal hint to OpenAI gpt-image-1 sizes
function openaiSizeFromFormato(formato: string): "1024x1024" | "1024x1536" | "1536x1024" {
  if (formato === "9:16" || formato === "4:5") return "1024x1536";
  if (formato === "16:9" || formato === "1.91:1") return "1536x1024";
  return "1024x1024";
}

import { ANGLE_BY_SLUG } from "../_shared/creativeAngles.ts";
import { requireUserOrServiceRole } from "../_shared/require-auth.ts";
import { copyPrompt, imageInstruction, parseCopy, planAxes, type VariationAxis, type VariationCopy, type VariationRequest } from "../_shared/creative-variations.ts";
import { installAiUsageTracking } from "../_shared/ai-usage.ts";
import { levaCopyPrompt, levaImagePrompt, levaToGenerate, parseLevaCopy, quickReview, type AnguloRef, type LevaContext, type LevaCopy } from "../_shared/leva-factory.ts";
import type { LevaItem } from "../_shared/batch-strategist.ts";
// Custo por automação (OP1.4): registra cada chamada de IA desta function em imphq_ai_usage.
installAiUsageTracking("creative-factory");

const ANGULO_PROMPTS: Record<string, string> = Object.fromEntries(
  Object.entries(ANGLE_BY_SLUG).map(([slug, a]) => [slug, a.visualPrompt])
);

async function scrapeReferencias(urls: string[]): Promise<string> {
  if (!FIRECRAWL_API_KEY || urls.length === 0) return "";
  const chunks: string[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      const data = await r.json();
      const md = data?.data?.markdown || data?.markdown || "";
      if (md) chunks.push(`### Referência: ${url}\n${md.slice(0, 1500)}`);
    } catch (e) {
      console.error("Firecrawl fail", url, e);
    }
  }
  return chunks.join("\n\n");
}

async function generateImageGemini(prompt: string, referenceImages: string[] = []): Promise<string | null> {
  const content: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] = [{ type: "text", text: prompt }];
  for (const img of referenceImages.slice(0, 3)) content.push({ type: "image_url", image_url: { url: img } });

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!resp.ok) {
    console.error("AI gen failed", resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function generateImageOpenAI(prompt: string, formato: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return null;
  }
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: openaiSizeFromFormato(formato),
        // gpt-image-1 always returns base64
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI image gen failed", resp.status, t.slice(0, 300));
      return null;
    }
    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.error("OpenAI image ex", e);
    return null;
  }
}

async function generateImage(provider: ImageProvider, prompt: string, referenceImages: string[], formato: string): Promise<string | null> {
  if (provider === "openai-image") return generateImageOpenAI(prompt, formato);
  return generateImageGemini(prompt, referenceImages);
}

// Edit via OpenAI gpt-image-1 (images/edits requires multipart)
async function generateImageOpenAIEdit(imageUrl: string, instruction: string, formato: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured for edit");
    return null;
  }
  try {
    // Download original image
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      console.error("Failed to fetch original image for OpenAI edit", imgResp.status);
      return null;
    }
    const imgBlob = await imgResp.blob();
    const ext = (imgBlob.type.split("/")[1] || "png").replace("jpeg", "png");

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", instruction.slice(0, 4000));
    form.append("size", openaiSizeFromFormato(formato));
    form.append("n", "1");
    form.append("image", new File([imgBlob], `source.${ext}`, { type: imgBlob.type || "image/png" }));

    const resp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI edit failed", resp.status, t.slice(0, 400));
      return null;
    }
    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.error("OpenAI edit ex", e);
    return null;
  }
}

async function uploadBase64ToStorage(
  sb: ReturnType<typeof makeClient>,
  base64DataUrl: string,
  projectId: string,
  batchId: string,
  assetId: string,
): Promise<{ publicUrl: string; storagePath: string } | null> {
  try {
    const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const binary = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const ext = mime.split("/")[1] || "png";
    const path = `${projectId}/${batchId}/${assetId}.${ext}`;
    const { error } = await sb.storage.from("creative-assets").upload(path, binary, {
      contentType: mime, upsert: true,
    });
    if (error) { console.error("upload fail", error); return null; }
    const { data } = sb.storage.from("creative-assets").getPublicUrl(path);
    return { publicUrl: data.publicUrl, storagePath: path };
  } catch (e) { console.error("upload ex", e); return null; }
}

async function generateHeadline(briefingText: string, angulo: string): Promise<string> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um copywriter de resposta direta brasileiro. Gere UMA headline curta (máx 8 palavras) para anúncio de Meta Ads. Apenas a headline, sem aspas, sem explicação." },
          { role: "user", content: `Produto/Briefing: ${briefingText}\nÂngulo: ${angulo}` },
        ],
      }),
    });
    const data = await resp.json();
    return (data?.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}

async function processBatch(batchId: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: batch, error: bErr } = await sb.from("imphq_creative_batches").select("*").eq("id", batchId).maybeSingle();
  if (bErr || !batch) { console.error("batch not found", bErr); return; }

  await sb.from("imphq_creative_batches").update({ status: "processing" }).eq("id", batchId);

  const briefing = batch.briefing || {};
  const briefingText = [
    briefing.produto && `Produto: ${briefing.produto}`,
    briefing.publico && `Público: ${briefing.publico}`,
    briefing.dor && `Dor: ${briefing.dor}`,
    briefing.desejo && `Desejo: ${briefing.desejo}`,
    briefing.mecanismo && `Mecanismo: ${briefing.mecanismo}`,
    briefing.extras && `Extras: ${briefing.extras}`,
  ].filter(Boolean).join("\n");

  let refsContext = batch.referencias_context || "";
  if (!refsContext && Array.isArray(batch.referencias_urls) && batch.referencias_urls.length > 0) {
    refsContext = await scrapeReferencias(batch.referencias_urls);
    await sb.from("imphq_creative_batches").update({ referencias_context: refsContext }).eq("id", batchId);
  }

  const angulos: string[] = Array.isArray(batch.angulos) && batch.angulos.length > 0
    ? batch.angulos : ["dor", "desejo", "prova", "curiosidade"];
  const expertFotos: string[] = Array.isArray(batch.expert_fotos) ? batch.expert_fotos : [];
  const formato = batch.formato || "1:1";
  const variacoesPorAngulo = Math.max(1, Math.min(3, Number(briefing.variacoes_por_angulo) || 2));
  const provider: ImageProvider = (briefing.image_provider === "openai-image" ? "openai-image" : "lovable-gemini");

  const totalPlanejado = angulos.length * variacoesPorAngulo;
  await sb.from("imphq_creative_batches").update({ total_planejado: totalPlanejado }).eq("id", batchId);
  console.log(`[creative-factory] batch=${batchId} provider=${provider} formato=${formato} total=${totalPlanejado}`);

  let totalGerado = 0;
  let erros = 0;

  for (const angulo of angulos) {
    const anguloBrief = ANGULO_PROMPTS[angulo] || `Foco em ${angulo}.`;
    for (let v = 0; v < variacoesPorAngulo; v++) {
      const varInstruction = v === 0
        ? "Composição principal, foco central no expert."
        : v === 1
          ? "Enquadramento alternativo: plano médio, fundo com textura/cor contrastante."
          : "Variação criativa: close-up com elementos gráficos sobrepostos.";

      const prompt = [
        `Anúncio de resposta direta para Meta Ads (Facebook/Instagram), formato ${formato}.`,
        anguloBrief, varInstruction,
        "Estilo: profissional, alta qualidade, luz natural, cores saturadas mas não saturated-kitsch.",
        "DEIXE ESPAÇO no topo ou base da imagem para overlay de texto curto.",
        briefingText && `\n--- BRIEFING ---\n${briefingText}`,
        refsContext && `\n--- REFERÊNCIAS DE ANÚNCIOS CONCORRENTES (inspire-se, não copie) ---\n${refsContext.slice(0, 2500)}`,
        expertFotos.length > 0 && "\nUse a(s) foto(s) do expert como base para gerar o rosto/identidade visual da pessoa na imagem.",
      ].filter(Boolean).join("\n");

      try {
        const imageDataUrl = await generateImage(provider, prompt, expertFotos, formato);
        if (!imageDataUrl) { erros++; continue; }

        const { data: inserted, error: insErr } = await sb.from("imphq_creative_assets").insert({
          batch_id: batchId, project_id: batch.project_id, user_id: batch.user_id,
          angulo, prompt_usado: prompt, image_url: "pending", formato,
          image_provider: provider,
        }).select("id").single();

        if (insErr || !inserted) { console.error("insert asset fail", insErr); erros++; continue; }

        const uploaded = await uploadBase64ToStorage(sb, imageDataUrl, batch.project_id, batchId, inserted.id);
        const finalUrl = uploaded?.publicUrl || imageDataUrl;
        const headline = await generateHeadline(briefingText, angulo);

        await sb.from("imphq_creative_assets").update({
          image_url: finalUrl, storage_path: uploaded?.storagePath || null, headline_copy: headline,
        }).eq("id", inserted.id);

        totalGerado++;
        await sb.from("imphq_creative_batches").update({ total_gerado: totalGerado }).eq("id", batchId);
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) { console.error("gen loop error", e); erros++; }
    }
  }

  await sb.from("imphq_creative_batches").update({
    status: erros > 0 && totalGerado === 0 ? "failed" : "completed",
    total_gerado: totalGerado,
    error_message: erros > 0 ? `${erros} falhas durante geração` : null,
  }).eq("id", batchId);
}


// ── Variações de um criativo vencedor (TST1.2) ──────────────────────────────
// A peça vencedora entra como referência visual; para cada eixo da Esteira P2 a IA escreve a copy
// (OpenRouter) e a Kie (Nano Banana Pro) recria a arte com o texto novo, mantendo pessoa e estilo.
// Não usa o gateway da Lovable (decisão de 05/10: plano lite fica para o que já roda).

const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const VARIATION_TEXT_MODEL = "google/gemini-2.5-flash";
const VARIATION_IMAGE_MODEL = "nano-banana-pro";
const KIE_POLL_MS = 6000;
const KIE_TIMEOUT_MS = 330_000;

async function writeVariationCopy(req: VariationRequest, axis: VariationAxis, used: string[]): Promise<VariationCopy | null> {
  if (!OPENROUTER_API_KEY) { console.error("[variations] OPENROUTER_API_KEY ausente"); return null; }
  const { system, user } = copyPrompt(req, axis, used);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: VARIATION_TEXT_MODEL,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!resp.ok) { console.error("[variations] copy", resp.status, (await resp.text()).slice(0, 200)); continue; }
      const data = await resp.json();
      const copy = parseCopy(data?.choices?.[0]?.message?.content ?? "");
      if (copy) return copy;
    } catch (e) { console.error("[variations] copy ex", e); }
  }
  return null;
}

async function kieCreateImage(prompt: string, refs: string[], aspect: string): Promise<string | null> {
  if (!KIE_API_KEY) { console.error("[variations] KIE_API_KEY ausente"); return null; }
  try {
    const resp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VARIATION_IMAGE_MODEL,
        input: { prompt: prompt.slice(0, 9500), image_input: refs.slice(0, 8), aspect_ratio: aspect, resolution: "2K", output_format: "jpg" },
      }),
    });
    const data = await resp.json().catch(() => ({}));
    const taskId = data?.data?.taskId || data?.taskId;
    if (!resp.ok || !taskId) { console.error("[variations] kie create", resp.status, JSON.stringify(data).slice(0, 300)); return null; }
    return String(taskId);
  } catch (e) { console.error("[variations] kie create ex", e); return null; }
}

/** Estado de uma tarefa da Kie: url pronta, falha ou ainda rodando. */
async function kieTaskResult(taskId: string): Promise<{ state: "ok"; url: string } | { state: "fail"; error: string } | { state: "running" }> {
  try {
    const r = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    });
    const data = await r.json().catch(() => ({}));
    const d = data?.data ?? {};
    const status = String(d.state || d.status || "").toLowerCase();
    let parsed: { resultUrls?: string[] } | null = null;
    try { parsed = d.resultJson ? JSON.parse(d.resultJson) : null; } catch { parsed = null; }
    const url = parsed?.resultUrls?.[0] || d.resultUrls?.[0];
    if (url && (status === "success" || status === "succeeded" || !status)) return { state: "ok", url };
    if (status === "fail" || status === "failed") return { state: "fail", error: d.failMsg || d.error || "Kie falhou" };
    return { state: "running" };
  } catch { return { state: "running" }; }
}

/** Baixa a imagem da Kie (o link expira) e devolve como data URL para o upload ao Storage. */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${ct};base64,${btoa(bin)}`;
  } catch { return null; }
}

async function processVariations(batchId: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: batch } = await sb.from("imphq_creative_batches").select("*").eq("id", batchId).maybeSingle();
  if (!batch) return;
  await sb.from("imphq_creative_batches").update({ status: "processing" }).eq("id", batchId);
  const b = (batch.briefing || {}) as Record<string, unknown>;
  const req: VariationRequest = {
    angulo: String(b.angulo || ""), hipotese: (b.hipotese as string) || null, oferta: String(b.oferta || ""),
    publico: (b.publico as string) || null, marca_topo: (b.marca_topo as string) || null, texto_base: (b.texto_base as string) || null,
    quantidade: Number(b.quantidade) || 1, eixos: Array.isArray(b.eixos) ? (b.eixos as VariationAxis[]) : undefined,
  };
  const baseImage = String(b.base_image_url || "");
  const formato = batch.formato || "4:5";
  const axes = planAxes(req);
  const erros: string[] = [];

  // 1. Copy de cada variação (curta, sequencial para não repetir headline).
  const used: string[] = [];
  const planned: Array<{ axis: VariationAxis; copy: VariationCopy; taskId: string | null }> = [];
  let seguidas = 0;
  for (const axis of axes) {
    if (seguidas >= 3) break; // anti-loop: provedor fora ou cota
    const copy = await writeVariationCopy(req, axis, used);
    if (!copy) { erros.push(`copy ${axis}`); seguidas++; continue; }
    seguidas = 0;
    used.push(copy.headline_arte);
    planned.push({ axis, copy, taskId: null });
  }

  // 2. Uma tarefa na Kie por variação, todas de uma vez.
  seguidas = 0;
  for (const p of planned) {
    if (seguidas >= 3) { erros.push("parou após 3 falhas seguidas na Kie"); break; }
    p.taskId = await kieCreateImage(imageInstruction(req, p.copy, formato), baseImage ? [baseImage] : [], formato);
    if (!p.taskId) { erros.push(`kie ${p.axis}`); seguidas++; } else seguidas = 0;
  }

  // 3. Acompanha até ficarem prontas (ou estourar o tempo) e grava no Storage.
  let gerados = 0;
  const pending = new Set(planned.filter((p) => p.taskId).map((p) => p.taskId as string));
  const deadline = Date.now() + KIE_TIMEOUT_MS;
  while (pending.size && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, KIE_POLL_MS));
    for (const p of planned) {
      if (!p.taskId || !pending.has(p.taskId)) continue;
      const res = await kieTaskResult(p.taskId);
      if (res.state === "running") continue;
      pending.delete(p.taskId);
      if (res.state === "fail") { erros.push(`kie ${p.axis}: ${res.error}`); continue; }
      const dataUrl = await fetchAsDataUrl(res.url);
      const { data: asset, error } = await sb.from("imphq_creative_assets").insert({
        batch_id: batchId, project_id: batch.project_id, user_id: batch.user_id, angulo: req.angulo,
        prompt_usado: `VARIATION [${p.axis}] kie:${VARIATION_IMAGE_MODEL} task:${p.taskId}`, image_url: "pending", formato,
        image_provider: "kie", headline_copy: p.copy.headline_anuncio,
        metadata: { tipo: "variacao", eixo: p.axis, copy: p.copy, hipotese: req.hipotese, base_image_url: baseImage, kie_task_id: p.taskId, modelo_texto: VARIATION_TEXT_MODEL },
      }).select("id").single();
      if (error || !asset) { erros.push(`insert ${p.axis}`); continue; }
      const uploaded = dataUrl ? await uploadBase64ToStorage(sb, dataUrl, batch.project_id, batchId, asset.id) : null;
      if (!uploaded) {
        // Sem Storage a arte não serve para anúncio: descarta em vez de gravar base64 ou link que expira.
        await sb.from("imphq_creative_assets").update({ reprovado: true, image_url: "upload-falhou" }).eq("id", asset.id);
        erros.push(`upload ${p.axis}`);
        continue;
      }
      await sb.from("imphq_creative_assets").update({ image_url: uploaded.publicUrl, storage_path: uploaded.storagePath }).eq("id", asset.id);
      gerados++;
      await sb.from("imphq_creative_batches").update({ total_gerado: gerados }).eq("id", batchId);
    }
  }
  if (pending.size) erros.push(`${pending.size} arte(s) não ficaram prontas a tempo na Kie`);
  await sb.from("imphq_creative_batches").update({
    status: gerados === 0 ? "failed" : "completed", total_gerado: gerados,
    error_message: erros.length ? erros.join("; ").slice(0, 500) : null,
  }).eq("id", batchId);
}

/** Copy de um item da leva (OPS1.4), no padrão do Método H&W. Duas tentativas, JSON validado. */
async function writeLevaCopy(item: LevaItem, ctx: LevaContext, used: string[]): Promise<LevaCopy | null> {
  if (!OPENROUTER_API_KEY) { console.error("[leva] OPENROUTER_API_KEY ausente"); return null; }
  const { system, user } = levaCopyPrompt(item, ctx, used);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: VARIATION_TEXT_MODEL, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!resp.ok) { console.error("[leva] copy", resp.status, (await resp.text()).slice(0, 200)); continue; }
      const data = await resp.json();
      const copy = parseLevaCopy(data?.choices?.[0]?.message?.content ?? "");
      if (copy) return copy;
    } catch (e) { console.error("[leva] copy ex", e); }
  }
  return null;
}

/**
 * Gera as artes de uma leva aprovada (OPS1.4): para cada item de imagem, escreve a copy pelo método, cria a arte na Kie
 * (referências do mercado só como inspiração), grava no Storage com as réguas no metadata e roda a checagem rápida do
 * Revisor. Anti-loop: para após 3 falhas seguidas em qualquer etapa.
 */
async function processLeva(batchId: string, ctxBase: { oferta: string; publico: string | null; marca_topo: string | null; limite: number }) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: batch } = await sb.from("imphq_creative_batches").select("*").eq("id", batchId).maybeSingle();
  if (!batch) return;
  const b = (batch.briefing || {}) as { itens?: LevaItem[] };
  const fila = levaToGenerate(b.itens ?? [], ctxBase.limite);
  const formato = "4:5";
  const erros: string[] = [];

  const libIds = [...new Set(fila.map((x) => x.item.copy_lib_id).filter(Boolean) as string[])];
  const refIds = [...new Set(fila.flatMap((x) => x.item.referencias))];
  const [{ data: lib }, { data: refs }] = await Promise.all([
    libIds.length ? sb.from("imphq_copy_library").select("id, nome, explicacao, exemplo, como_usar").in("id", libIds) : Promise.resolve({ data: [] }),
    refIds.length ? sb.from("imphq_referencias").select("id, titulo, image_url").in("id", refIds) : Promise.resolve({ data: [] }),
  ]);
  const libBy = new Map((lib ?? []).map((l: AnguloRef & { id: string }) => [l.id, l]));
  const refBy = new Map((refs ?? []).map((r: { id: string; titulo: string | null; image_url: string | null }) => [r.id, r]));

  // 1. Copy de cada item (sequencial, para não repetir headline).
  const used: string[] = [];
  const planned: Array<{ idx: number; item: LevaItem; copy: LevaCopy; refImgs: string[]; taskId: string | null }> = [];
  let seguidas = 0;
  for (const { idx, item } of fila) {
    if (seguidas >= 3) { erros.push("copy: parou após 3 falhas seguidas"); break; }
    const itemRefs = item.referencias.map((id) => refBy.get(id)).filter(Boolean) as Array<{ titulo: string | null; image_url: string | null }>;
    const ctx: LevaContext = { ...ctxBase, angulo: item.copy_lib_id ? libBy.get(item.copy_lib_id) ?? null : null, referencias: itemRefs.map((r) => r.titulo ?? "").filter(Boolean) };
    const copy = await writeLevaCopy(item, ctx, used);
    if (!copy) { erros.push(`copy item ${idx + 1}`); seguidas++; continue; }
    seguidas = 0;
    used.push(copy.headline_arte);
    planned.push({ idx, item, copy, refImgs: itemRefs.map((r) => r.image_url ?? "").filter((u) => /^https?:\/\//.test(u)).slice(0, 2), taskId: null });
  }

  // 2. Uma tarefa na Kie por item.
  seguidas = 0;
  for (const p of planned) {
    if (seguidas >= 3) { erros.push("Kie: parou após 3 falhas seguidas"); break; }
    p.taskId = await kieCreateImage(levaImagePrompt(p.item, p.copy, ctxBase, formato, p.refImgs.length > 0), p.refImgs, formato);
    if (!p.taskId) { erros.push(`kie item ${p.idx + 1}`); seguidas++; } else seguidas = 0;
  }

  // 3. Acompanha até ficarem prontas e grava no Storage.
  let gerados = 0;
  const pending = new Set(planned.filter((p) => p.taskId).map((p) => p.taskId as string));
  const deadline = Date.now() + KIE_TIMEOUT_MS;
  while (pending.size && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, KIE_POLL_MS));
    for (const p of planned) {
      if (!p.taskId || !pending.has(p.taskId)) continue;
      const res = await kieTaskResult(p.taskId);
      if (res.state === "running") continue;
      pending.delete(p.taskId);
      if (res.state === "fail") { erros.push(`kie item ${p.idx + 1}: ${res.error}`); continue; }
      const dataUrl = await fetchAsDataUrl(res.url);
      const revisao = quickReview(p.copy);
      const { data: asset, error } = await sb.from("imphq_creative_assets").insert({
        batch_id: batchId, project_id: batch.project_id, user_id: batch.user_id, angulo: p.item.angulo,
        prompt_usado: `LEVA [${p.item.bloco}] kie:${VARIATION_IMAGE_MODEL} task:${p.taskId}`, image_url: "pending", formato,
        image_provider: "kie", headline_copy: p.copy.headline_anuncio, reprovado: revisao.reprova,
        metadata: {
          tipo: "leva", item: p.idx, bloco: p.item.bloco, copy_lib_id: p.item.copy_lib_id, formato_criativo: p.item.formato,
          porta: p.item.porta, ponto_rota: p.item.ponto_rota, carga: p.item.carga, hipotese: p.item.hipotese,
          copy: p.copy, texto_anuncio: p.copy.texto_anuncio, referencias: p.item.referencias, kie_task_id: p.taskId,
          modelo_texto: VARIATION_TEXT_MODEL, revisao_rapida: revisao,
        },
      }).select("id").single();
      if (error || !asset) { erros.push(`insert item ${p.idx + 1}`); continue; }
      const uploaded = dataUrl ? await uploadBase64ToStorage(sb, dataUrl, batch.project_id, batchId, asset.id) : null;
      if (!uploaded) {
        await sb.from("imphq_creative_assets").update({ reprovado: true, image_url: "upload-falhou" }).eq("id", asset.id);
        erros.push(`upload item ${p.idx + 1}`);
        continue;
      }
      await sb.from("imphq_creative_assets").update({ image_url: uploaded.publicUrl, storage_path: uploaded.storagePath }).eq("id", asset.id);
      gerados++;
      await sb.from("imphq_creative_batches").update({ total_gerado: gerados }).eq("id", batchId);
    }
  }
  if (pending.size) erros.push(`${pending.size} arte(s) não ficaram prontas a tempo na Kie`);
  await sb.from("imphq_creative_batches").update({
    status: gerados === 0 ? "failed" : "completed", total_gerado: gerados,
    error_message: erros.length ? erros.join("; ").slice(0, 500) : null,
  }).eq("id", batchId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Usuário logado ou chamada interna (project-mcp) com a chave de serviço, em nome de alguém do time.
  const _auth = await requireUserOrServiceRole(req);
  if (!_auth.ok) return _auth.response;

  try {
    // Lote clássico e edição usam o gateway da Lovable; variações usam Kie + OpenRouter.
    if (!LOVABLE_API_KEY && !(Deno.env.get("KIE_API_KEY") && Deno.env.get("OPENROUTER_API_KEY"))) {
      return new Response(JSON.stringify({ error: "Nenhum provedor de IA configurado (LOVABLE_API_KEY ou KIE_API_KEY + OPENROUTER_API_KEY)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    let bodyParsed: z.infer<typeof requestSchema> | null = null;
    if (req.method === "POST") {
      try { bodyParsed = requestSchema.parse(await req.json()); } catch { bodyParsed = null; }
    }
    const action = bodyParsed?.action || url.searchParams.get("action") || (req.method === "POST" ? "start" : "get");

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sbUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let userId: string;
    if (_auth.userId === "service_role") {
      // Chamada interna: user_id precisa ser de alguém do time.
      const asUser = typeof (bodyParsed as Record<string, unknown> | null)?.user_id === "string" ? String((bodyParsed as Record<string, unknown>).user_id) : "";
      const { data: member } = asUser ? await sbUser.from("imphq_team_members").select("user_id").eq("user_id", asUser).maybeSingle() : { data: null };
      if (!member?.user_id) {
        return new Response(JSON.stringify({ error: "user_id de alguém do time é obrigatório na chamada interna" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = member.user_id;
    } else {
      const { data: userData, error: uErr } = await sbUser.auth.getUser(jwt);
      if (uErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "start") {
      const body = bodyParsed || {};
      const { project_id, nome, briefing, referencias_urls, expert_fotos, angulos, formato } = body;
      if (!project_id) {
        return new Response(JSON.stringify({ error: "project_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: batch, error } = await sb.from("imphq_creative_batches").insert({
        project_id, user_id: userId,
        nome: nome || `Batch ${new Date().toLocaleString("pt-BR")}`,
        briefing: briefing || {},
        referencias_urls: referencias_urls || [],
        expert_fotos: expert_fotos || [],
        angulos: angulos || ["dor", "desejo", "prova", "curiosidade"],
        formato: formato || "1:1",
        status: "pending",
      }).select().single();

      if (error || !batch) {
        return new Response(JSON.stringify({ error: error?.message || "Insert failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Edge runtime background task.
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // Edge runtime background task.
        EdgeRuntime.waitUntil(processBatch(batch.id));
      } else {
        processBatch(batch.id).catch((e) => console.error("bg fail", e));
      }

      return new Response(JSON.stringify({ ok: true, batch_id: batch.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "variations") {
      const body = (bodyParsed || {}) as Record<string, unknown>;
      const projectId = String(body.project_id || "");
      const baseImage = String(body.base_image_url || "");
      const angulo = String(body.angulo || "").trim();
      if (!projectId || !baseImage.startsWith("http") || !angulo || !body.oferta) {
        return new Response(JSON.stringify({ error: "project_id, base_image_url (http), angulo e oferta são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const quantidade = Math.max(1, Math.min(6, Number(body.quantidade) || 2));
      const { data: batch, error } = await sb.from("imphq_creative_batches").insert({
        project_id: projectId, user_id: userId,
        nome: String(body.nome || `Variações · ${angulo}`).slice(0, 120),
        briefing: {
          tipo: "variacoes", angulo, hipotese: body.hipotese ?? null, oferta: body.oferta, publico: body.publico ?? null,
          marca_topo: body.marca_topo ?? null, texto_base: body.texto_base ?? null, quantidade,
          eixos: Array.isArray(body.eixos) ? body.eixos : null, base_image_url: baseImage,
        },
        referencias_urls: [baseImage], angulos: [angulo], formato: String(body.formato || "4:5"),
        status: "pending", total_planejado: quantidade,
      }).select("id").single();
      if (error || !batch) {
        return new Response(JSON.stringify({ error: error?.message || "Insert failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(processVariations(batch.id));
      else processVariations(batch.id).catch((e) => console.error("bg variations", e));
      return new Response(JSON.stringify({ ok: true, batch_id: batch.id, quantidade }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "leva") {
      // OPS1.4: só gera leva APROVADA por alguém do time; uma rodada por vez (status vira "processing").
      const body = (bodyParsed || {}) as Record<string, unknown>;
      const levaId = String(body.leva_id || "");
      const oferta = String(body.oferta || "").trim();
      if (!levaId || !oferta) {
        return new Response(JSON.stringify({ error: "leva_id e oferta são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: leva } = await sb.from("imphq_creative_batches").select("id, status, briefing").eq("id", levaId).maybeSingle();
      const tipo = (leva?.briefing as { tipo?: string } | null)?.tipo;
      if (!leva || tipo !== "leva") return new Response(JSON.stringify({ error: "leva não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (leva.status !== "aprovado") {
        return new Response(JSON.stringify({ error: `a leva está "${leva.status}": só gera leva aprovada` }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const limite = Math.max(1, Math.min(20, Number(body.limite) || 20));
      const itens = ((leva.briefing as { itens?: LevaItem[] }).itens ?? []);
      const total = levaToGenerate(itens, limite).length;
      await sb.from("imphq_creative_batches").update({
        status: "processing", total_planejado: total, total_gerado: 0, error_message: null,
        briefing: { ...(leva.briefing as Record<string, unknown>), geracao: { oferta, publico: body.publico ?? null, marca_topo: body.marca_topo ?? null, limite, por: userId, em: new Date().toISOString() } },
      }).eq("id", levaId);
      const ctx = { oferta, publico: (body.publico as string) || null, marca_topo: (body.marca_topo as string) || null, limite };
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(processLeva(levaId, ctx));
      else processLeva(levaId, ctx).catch((e) => console.error("bg leva", e));
      return new Response(JSON.stringify({ ok: true, leva_id: levaId, gerando: total, sem_video: itens.length - itens.filter((i) => i.precisa_video).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "edit_asset") {
      const { asset_id, instruction, image_provider: providerOverride } = bodyParsed || {};
      if (!asset_id || !instruction) {
        return new Response(JSON.stringify({ error: "asset_id and instruction required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: asset, error } = await sb.from("imphq_creative_assets").select("*")
        .eq("id", asset_id).eq("user_id", userId).maybeSingle();
      if (error || !asset) {
        return new Response(JSON.stringify({ error: "Asset not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve provider: explicit override > asset's original provider > default Gemini
      const editProvider: ImageProvider =
        providerOverride === "openai-image" || providerOverride === "lovable-gemini"
          ? providerOverride
          : (asset.image_provider === "openai-image" ? "openai-image" : "lovable-gemini");

      let newDataUrl: string | null = null;
      let editError: string | null = null;

      if (editProvider === "openai-image") {
        if (!OPENAI_API_KEY) {
          return new Response(JSON.stringify({
            error: "OpenAI gpt-image-1 indisponível: OPENAI_API_KEY não configurada. Use Gemini ou adicione a chave nos secrets.",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        newDataUrl = await generateImageOpenAIEdit(asset.image_url, instruction, asset.formato || "1:1");
        if (!newDataUrl) editError = "OpenAI gpt-image-1 falhou ao editar (verifique cota/billing ou conteúdo bloqueado).";
      } else {
        const editResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: instruction },
                { type: "image_url", image_url: { url: asset.image_url } },
              ],
            }],
            modalities: ["image", "text"],
          }),
        });
        const data = await editResp.json();
        newDataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
        if (!newDataUrl) editError = "Gemini falhou ao editar (resposta sem imagem).";
      }

      if (!newDataUrl) {
        return new Response(JSON.stringify({ error: editError || "Edit failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parentVersion = asset.version || 1;
      const { data: newAsset, error: insErr } = await sb.from("imphq_creative_assets").insert({
        batch_id: asset.batch_id, project_id: asset.project_id, user_id: userId,
        angulo: asset.angulo, prompt_usado: `EDIT [${editProvider}]: ${instruction}`,
        image_url: "pending", formato: asset.formato,
        parent_asset_id: asset.id, version: parentVersion + 1,
        edit_instruction: instruction, headline_copy: asset.headline_copy,
        image_provider: editProvider,
      }).select().single();

      if (insErr || !newAsset) {
        return new Response(JSON.stringify({ error: insErr?.message || "Insert fail" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const uploaded = await uploadBase64ToStorage(sb, newDataUrl, asset.project_id, asset.batch_id, newAsset.id);
      const finalUrl = uploaded?.publicUrl || newDataUrl;

      await sb.from("imphq_creative_assets").update({
        image_url: finalUrl, storage_path: uploaded?.storagePath || null,
      }).eq("id", newAsset.id);

      return new Response(JSON.stringify({ ok: true, asset_id: newAsset.id, image_url: finalUrl, provider: editProvider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "export_to_midia") {
      const { asset_ids } = bodyParsed || {};
      if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
        return new Response(JSON.stringify({ error: "asset_ids array required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: assets, error } = await sb.from("imphq_creative_assets").select("*")
        .in("id", asset_ids).eq("user_id", userId);
      if (error || !assets) {
        return new Response(JSON.stringify({ error: error?.message || "Fetch fail" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let exported = 0;
      for (const asset of assets) {
        if (asset.exported_to_midia) continue;
        const { data: midia, error: mErr } = await sb.from("imphq_content_library").insert({
          project_id: asset.project_id, user_id: userId,
          title: `Criativo ${asset.angulo} ${asset.version || 1}`,
          file_url: asset.image_url, file_type: "image",
          tags: ["criativo", "ia", asset.angulo],
          content_category: "criativos",
          description: asset.headline_copy || null,
        }).select("id").single();
        if (mErr || !midia) { console.error("midia insert fail", mErr); continue; }
        await sb.from("imphq_creative_assets").update({
          exported_to_midia: true, midia_id: midia.id,
        }).eq("id", asset.id);
        exported++;
      }

      return new Response(JSON.stringify({ ok: true, exported }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const eMessage = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : undefined;
    console.error("fatal", e);
    return new Response(JSON.stringify({ error: eMessage || "fatal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

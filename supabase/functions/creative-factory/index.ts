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
  const content: any[] = [{ type: "text", text: prompt }];
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
  sb: any,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    let bodyParsed: any = null;
    if (req.method === "POST") {
      try { bodyParsed = await req.json(); } catch { bodyParsed = null; }
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
    const { data: userData, error: uErr } = await sbUser.auth.getUser(jwt);
    if (uErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
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

      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(processBatch(batch.id));
      } else {
        processBatch(batch.id).catch((e) => console.error("bg fail", e));
      }

      return new Response(JSON.stringify({ ok: true, batch_id: batch.id }), {
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
          : ((asset as any).image_provider === "openai-image" ? "openai-image" : "lovable-gemini");

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

      const parentVersion = (asset as any).version || 1;
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
        if ((asset as any).exported_to_midia) continue;
        const { data: midia, error: mErr } = await sb.from("imphq_content_library").insert({
          project_id: asset.project_id, user_id: userId,
          title: `Criativo ${asset.angulo} ${(asset as any).version || 1}`,
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
  } catch (e: any) {
    console.error("fatal", e);
    return new Response(JSON.stringify({ error: e?.message || "fatal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

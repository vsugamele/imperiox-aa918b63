import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

// Ângulos pré-definidos e suas diretrizes de prompt
const ANGULO_PROMPTS: Record<string, string> = {
  dor: "Foco na DOR: mostrar a frustração, o problema sentido pelo avatar. Expressão facial de cansaço/frustração. Atmosfera de problema a ser resolvido.",
  desejo: "Foco no DESEJO: mostrar a transformação aspiracional, a vida ideal. Expressão de felicidade, conquista. Ambiente luxuoso/sonhado.",
  prova: "Foco na PROVA SOCIAL: mostrar depoimentos, números, resultados concretos. Elementos visuais de credibilidade (checkmarks, estrelas, números grandes).",
  autoridade: "Foco na AUTORIDADE: expert posicionado como especialista. Fundo profissional, postura de liderança, confiança absoluta.",
  curiosidade: "Foco na CURIOSIDADE: criar gancho visual intrigante, pergunta no ar, elemento misterioso que faça a pessoa PARAR o scroll.",
  "antes-depois": "Foco no ANTES vs DEPOIS: dividir a imagem com contraste visual claro entre o estado atual ruim e o resultado alcançado.",
  objecao: "Foco em DESTRUIR OBJEÇÃO: imagem que responde visualmente 'não tenho tempo', 'é caro', 'não funciona pra mim'.",
};

const FORMATOS: Record<string, string> = {
  "1:1": "1:1",
  "4:5": "4:5",
  "9:16": "9:16",
};

async function scrapeReferencias(urls: string[]): Promise<string> {
  if (!FIRECRAWL_API_KEY || urls.length === 0) return "";
  const chunks: string[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
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

async function generateImage(prompt: string, referenceImages: string[] = []): Promise<string | null> {
  const content: any[] = [{ type: "text", text: prompt }];
  for (const img of referenceImages.slice(0, 3)) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("AI gen failed", resp.status, text);
    return null;
  }
  const data = await resp.json();
  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  return url || null;
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
    const base64 = match[2];
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const ext = mime.split("/")[1] || "png";
    const path = `${projectId}/${batchId}/${assetId}.${ext}`;

    const { error } = await sb.storage.from("creative-assets").upload(path, binary, {
      contentType: mime,
      upsert: true,
    });
    if (error) {
      console.error("upload fail", error);
      return null;
    }
    const { data } = sb.storage.from("creative-assets").getPublicUrl(path);
    return { publicUrl: data.publicUrl, storagePath: path };
  } catch (e) {
    console.error("upload ex", e);
    return null;
  }
}

async function generateHeadline(briefingText: string, angulo: string): Promise<string> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é um copywriter de resposta direta brasileiro. Gere UMA headline curta (máx 8 palavras) para anúncio de Meta Ads. Apenas a headline, sem aspas, sem explicação.",
          },
          { role: "user", content: `Produto/Briefing: ${briefingText}\nÂngulo: ${angulo}` },
        ],
      }),
    });
    const data = await resp.json();
    return (data?.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

async function processBatch(batchId: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: batch, error: bErr } = await sb
    .from("imphq_creative_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (bErr || !batch) {
    console.error("batch not found", bErr);
    return;
  }

  await sb.from("imphq_creative_batches").update({ status: "processing" }).eq("id", batchId);

  const briefing = batch.briefing || {};
  const briefingText = [
    briefing.produto && `Produto: ${briefing.produto}`,
    briefing.publico && `Público: ${briefing.publico}`,
    briefing.dor && `Dor: ${briefing.dor}`,
    briefing.desejo && `Desejo: ${briefing.desejo}`,
    briefing.mecanismo && `Mecanismo: ${briefing.mecanismo}`,
    briefing.extras && `Extras: ${briefing.extras}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Scrape referências (uma vez só, reaproveitamos no loop)
  let refsContext = batch.referencias_context || "";
  if (!refsContext && Array.isArray(batch.referencias_urls) && batch.referencias_urls.length > 0) {
    refsContext = await scrapeReferencias(batch.referencias_urls);
    await sb.from("imphq_creative_batches").update({ referencias_context: refsContext }).eq("id", batchId);
  }

  const angulos: string[] = Array.isArray(batch.angulos) && batch.angulos.length > 0
    ? batch.angulos
    : ["dor", "desejo", "prova", "curiosidade"];
  const expertFotos: string[] = Array.isArray(batch.expert_fotos) ? batch.expert_fotos : [];
  const formato = batch.formato || "1:1";
  const variacoesPorAngulo = Math.max(1, Math.min(3, Number(briefing.variacoes_por_angulo) || 2));

  const totalPlanejado = angulos.length * variacoesPorAngulo;
  await sb
    .from("imphq_creative_batches")
    .update({ total_planejado: totalPlanejado })
    .eq("id", batchId);

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
        anguloBrief,
        varInstruction,
        "Estilo: profissional, alta qualidade, luz natural, cores saturadas mas não saturated-kitsch.",
        "DEIXE ESPAÇO no topo ou base da imagem para overlay de texto curto.",
        briefingText && `\n--- BRIEFING ---\n${briefingText}`,
        refsContext && `\n--- REFERÊNCIAS DE ANÚNCIOS CONCORRENTES (inspire-se, não copie) ---\n${refsContext.slice(0, 2500)}`,
        expertFotos.length > 0 && "\nUse a(s) foto(s) do expert como base para gerar o rosto/identidade visual da pessoa na imagem.",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const imageDataUrl = await generateImage(prompt, expertFotos);
        if (!imageDataUrl) {
          erros++;
          continue;
        }

        // Inserir linha primeiro (com URL temporário), depois upload e update
        const { data: inserted, error: insErr } = await sb
          .from("imphq_creative_assets")
          .insert({
            batch_id: batchId,
            project_id: batch.project_id,
            user_id: batch.user_id,
            angulo,
            prompt_usado: prompt,
            image_url: "pending",
            formato,
          })
          .select("id")
          .single();

        if (insErr || !inserted) {
          console.error("insert asset fail", insErr);
          erros++;
          continue;
        }

        const uploaded = await uploadBase64ToStorage(
          sb,
          imageDataUrl,
          batch.project_id,
          batchId,
          inserted.id,
        );
        const finalUrl = uploaded?.publicUrl || imageDataUrl;

        // Gerar headline em paralelo (melhor esforço)
        const headline = await generateHeadline(briefingText, angulo);

        await sb
          .from("imphq_creative_assets")
          .update({
            image_url: finalUrl,
            storage_path: uploaded?.storagePath || null,
            headline_copy: headline,
          })
          .eq("id", inserted.id);

        totalGerado++;
        await sb
          .from("imphq_creative_batches")
          .update({ total_gerado: totalGerado })
          .eq("id", batchId);

        // Rate limit leve
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.error("gen loop error", e);
        erros++;
      }
    }
  }

  await sb
    .from("imphq_creative_batches")
    .update({
      status: erros > 0 && totalGerado === 0 ? "failed" : "completed",
      total_gerado: totalGerado,
      error_message: erros > 0 ? `${erros} falhas durante geração` : null,
    })
    .eq("id", batchId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "POST" ? "start" : "get");

    // Autenticação baseada no JWT do caller
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sbUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: uErr } = await sbUser.auth.getUser(jwt);
    if (uErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    if (action === "start") {
      const body = await req.json();
      const { project_id, nome, briefing, referencias_urls, expert_fotos, angulos, formato } = body || {};
      if (!project_id) {
        return new Response(JSON.stringify({ error: "project_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: batch, error } = await sb
        .from("imphq_creative_batches")
        .insert({
          project_id,
          user_id: userId,
          nome: nome || `Batch ${new Date().toLocaleString("pt-BR")}`,
          briefing: briefing || {},
          referencias_urls: referencias_urls || [],
          expert_fotos: expert_fotos || [],
          angulos: angulos || ["dor", "desejo", "prova", "curiosidade"],
          formato: formato || "1:1",
          status: "pending",
        })
        .select()
        .single();

      if (error || !batch) {
        return new Response(JSON.stringify({ error: error?.message || "Insert failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // dispara processamento em background
      // @ts-ignore EdgeRuntime existe no deploy
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

    // Allow action to come from body too (for supabase.functions.invoke compatibility)
    let bodyParsed: any = null;
    if (req.method === "POST") {
      try {
        bodyParsed = await req.json();
      } catch {
        bodyParsed = null;
      }
    }
    const finalAction = bodyParsed?.action || action;

    if (finalAction === "edit_asset") {
      const { asset_id, instruction } = bodyParsed || {};
      if (!asset_id || !instruction) {
        return new Response(JSON.stringify({ error: "asset_id and instruction required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: asset, error } = await sb
        .from("imphq_creative_assets")
        .select("*")
        .eq("id", asset_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !asset) {
        return new Response(JSON.stringify({ error: "Asset not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const editResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instruction },
                { type: "image_url", image_url: { url: asset.image_url } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      const data = await editResp.json();
      const newDataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!newDataUrl) {
        return new Response(JSON.stringify({ error: "Edit failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newAsset, error: insErr } = await sb
        .from("imphq_creative_assets")
        .insert({
          batch_id: asset.batch_id,
          project_id: asset.project_id,
          user_id: userId,
          angulo: asset.angulo,
          prompt_usado: `EDIT: ${instruction}`,
          image_url: "pending",
          formato: asset.formato,
          parent_asset_id: asset.id,
          headline_copy: asset.headline_copy,
        })
        .select()
        .single();

      if (insErr || !newAsset) {
        return new Response(JSON.stringify({ error: insErr?.message || "Insert fail" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const uploaded = await uploadBase64ToStorage(
        sb,
        newDataUrl,
        asset.project_id,
        asset.batch_id,
        newAsset.id,
      );
      const finalUrl = uploaded?.publicUrl || newDataUrl;

      await sb
        .from("imphq_creative_assets")
        .update({ image_url: finalUrl, storage_path: uploaded?.storagePath || null })
        .eq("id", newAsset.id);

      return new Response(JSON.stringify({ ok: true, asset_id: newAsset.id, image_url: finalUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("fatal", e);
    return new Response(JSON.stringify({ error: e?.message || "fatal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
const LUMA_API_KEY = Deno.env.get("LUMA_API_KEY");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const BUCKET = "creative-assets";

type Body = {
  kind: "image" | "video" | "audio";
  provider: "openrouter" | "kie" | "elevenlabs" | "luma";
  model: string;
  prompt: string;
  negative_prompt?: string;
  params?: Record<string, any>;
  nicho?: string;
  projeto_id?: string;
  source_prompt_id?: string;
  // image-to-video
  image_url?: string;
  // audio
  voice_id?: string;
};

async function uploadFromBase64(supabase: any, userId: string, b64: string, ext: string, mime: string) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `studio/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bin, { contentType: mime, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadFromUrl(supabase: any, userId: string, url: string, ext: string, mime: string) {
  const r = await fetch(url);
  const buf = new Uint8Array(await r.arrayBuffer());
  const path = `studio/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- OPENROUTER: IMAGE ----------
async function openrouterImage(model: string, prompt: string): Promise<string> {
  // OpenRouter image-generation models return image data via choices[0].message.images
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) throw new Error(`OpenRouter image ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("OpenRouter: nenhuma imagem retornada");
  return url; // can be data: URL or http
}

// ---------- OPENROUTER: VIDEO (Seedance) ----------
async function openrouterVideo(model: string, prompt: string, params: any, image_url?: string): Promise<{ url: string; cost?: number }> {
  // Seedance via OpenRouter — content can include image_url for image-to-video
  const content: any[] = [{ type: "text", text: prompt }];
  if (image_url) content.push({ type: "image_url", image_url: { url: image_url } });

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      modalities: ["video", "text"],
      video_config: {
        duration: params?.duration ?? 5,
        resolution: params?.resolution ?? "720p",
        aspect_ratio: params?.aspect_ratio ?? "16:9",
      },
    }),
  });
  if (!resp.ok) throw new Error(`OpenRouter video ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const url =
    data?.choices?.[0]?.message?.videos?.[0]?.video_url?.url ||
    data?.choices?.[0]?.message?.video_url ||
    data?.choices?.[0]?.message?.content?.[0]?.video_url?.url;
  if (!url) throw new Error("OpenRouter: nenhum vídeo retornado. Resposta: " + JSON.stringify(data).slice(0, 500));
  return { url, cost: data?.usage?.cost };
}

// ---------- KIE.AI: VIDEO ----------
async function kieVideo(model: string, prompt: string, params: any, image_url?: string): Promise<{ taskId: string }> {
  // Kie.ai unified API. Models: veo3, veo3-fast, sora-2, kling-2.1, runway-gen4, bytedance/seedance-2 etc.
  const isSeedance2 = model === "seedance-2" || model === "bytedance/seedance-2";
  const refAudios: string[] | undefined = Array.isArray(params?.reference_audio_urls) && params.reference_audio_urls.length > 0
    ? params.reference_audio_urls.slice(0, 3)
    : undefined;

  const input: any = {
    prompt,
    duration: params?.duration ?? 5,
    aspect_ratio: params?.aspect_ratio ?? "16:9",
  };

  if (isSeedance2) {
    if (params?.resolution) input.resolution = params.resolution;
    // Seedance 2 lipsync: first_frame_url + reference_audio_urls (mutually exclusive with last_frame_url)
    if (image_url) input.first_frame_url = image_url;
    if (refAudios) {
      input.reference_audio_urls = refAudios;
      input.generate_audio = false;
    } else if (params?.generate_audio !== undefined) {
      input.generate_audio = params.generate_audio;
    }
  } else if (image_url) {
    input.image_url = image_url;
  }

  const body: any = {
    model: isSeedance2 ? "bytedance/seedance-2" : model,
    input,
  };
  const resp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Kie create ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const taskId = data?.data?.taskId || data?.taskId || data?.data?.task_id;
  if (!taskId) throw new Error("Kie.ai: taskId ausente. " + JSON.stringify(data).slice(0, 300));
  return { taskId };
}

// ---------- KIE.AI: IMAGE (GPT Image 2 etc) ----------
async function kieImage(model: string, prompt: string, params: any, image_input?: string): Promise<{ taskId: string }> {
  const input: any = {
    prompt,
    size: params?.size ?? "1024x1024",
    quality: params?.quality ?? "high",
    ...(params?.aspect_ratio ? { aspect_ratio: params.aspect_ratio } : {}),
    ...(image_input ? { image_input } : {}),
  };
  const resp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  if (!resp.ok) throw new Error(`Kie image ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const taskId = data?.data?.taskId || data?.taskId || data?.data?.task_id;
  if (!taskId) throw new Error("Kie.ai: taskId ausente. " + JSON.stringify(data).slice(0, 300));
  return { taskId };
}

// ---------- LUMA: IMAGE (uni-1) ----------
async function lumaImage(model: string, prompt: string, params: any, image_url?: string): Promise<{ id: string }> {
  const body: any = {
    model: model || "uni-1",
    type: image_url ? "edit" : "image",
    prompt,
    ...(params?.aspect_ratio ? { aspect_ratio: params.aspect_ratio } : {}),
    ...(image_url ? { image: { url: image_url } } : {}),
  };
  const resp = await fetch("https://api.lumalabs.ai/agents/v1/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${LUMA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Luma create ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const id = data?.id || data?.generation?.id;
  if (!id) throw new Error("Luma: id ausente. " + JSON.stringify(data).slice(0, 300));
  return { id };
}

async function elevenlabsTts(voice_id: string, text: string, model: string): Promise<{ b64: string }> {
  const vid = voice_id || "JBFqnCBsd6RMkjVDRZzb";
  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model || "eleven_multilingual_v2" }),
  });
  if (!resp.ok) throw new Error(`ElevenLabs ${resp.status}: ${await resp.text()}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
  return { b64: btoa(bin) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json()) as Body;
    const { kind, provider, model, prompt } = body;
    if (!kind || !provider || !model || !prompt) {
      return new Response(JSON.stringify({ error: "kind, provider, model, prompt obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert pending row
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: row, error: insErr } = await admin
      .from("imphq_studio_generations")
      .insert({
        user_id: userId,
        kind,
        provider,
        model,
        prompt,
        negative_prompt: body.negative_prompt,
        params: body.params || {},
        status: provider === "kie" || provider === "luma" ? "processing" : "pending",
        nicho: body.nicho,
        projeto_id: body.projeto_id,
        source_prompt_id: body.source_prompt_id,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    try {
      if (kind === "image" && provider === "openrouter") {
        if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY ausente");
        const url = await openrouterImage(model, prompt);
        let publicUrl = url;
        if (url.startsWith("data:")) {
          const [meta, b64] = url.split(",");
          const mime = meta.match(/data:([^;]+)/)?.[1] || "image/png";
          const ext = mime.split("/")[1] || "png";
          publicUrl = await uploadFromBase64(admin, userId, b64, ext, mime);
        } else {
          publicUrl = await uploadFromUrl(admin, userId, url, "png", "image/png");
        }
        await admin.from("imphq_studio_generations").update({ status: "completed", output_url: publicUrl }).eq("id", row.id);
        return new Response(JSON.stringify({ ok: true, id: row.id, output_url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (kind === "video" && provider === "openrouter") {
        if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY ausente");
        const { url, cost } = await openrouterVideo(model, prompt, body.params || {}, body.image_url);
        const publicUrl = url.startsWith("http")
          ? await uploadFromUrl(admin, userId, url, "mp4", "video/mp4")
          : url;
        await admin.from("imphq_studio_generations").update({ status: "completed", output_url: publicUrl, cost_usd: cost }).eq("id", row.id);
        return new Response(JSON.stringify({ ok: true, id: row.id, output_url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (kind === "video" && provider === "kie") {
        if (!KIE_API_KEY) throw new Error("KIE_API_KEY ausente");
        const { taskId } = await kieVideo(model, prompt, body.params || {}, body.image_url);
        await admin.from("imphq_studio_generations").update({ status: "processing", external_id: taskId }).eq("id", row.id);
        return new Response(JSON.stringify({ ok: true, id: row.id, taskId, status: "processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (kind === "image" && provider === "kie") {
        if (!KIE_API_KEY) throw new Error("KIE_API_KEY ausente");
        const { taskId } = await kieImage(model, prompt, body.params || {}, body.image_url);
        await admin.from("imphq_studio_generations").update({ status: "processing", external_id: taskId }).eq("id", row.id);
        return new Response(JSON.stringify({ ok: true, id: row.id, taskId, status: "processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (kind === "image" && provider === "luma") {
        if (!LUMA_API_KEY) throw new Error("LUMA_API_KEY ausente — adicione em Edge Function Secrets");
        const { id: extId } = await lumaImage(model, prompt, body.params || {}, body.image_url);
        await admin.from("imphq_studio_generations").update({ status: "processing", external_id: extId }).eq("id", row.id);
        return new Response(JSON.stringify({ ok: true, id: row.id, taskId: extId, status: "processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (kind === "audio" && provider === "elevenlabs") {
        if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY ausente");
        const { b64 } = await elevenlabsTts(body.voice_id || "", prompt, model);
        const publicUrl = await uploadFromBase64(admin, userId, b64, "mp3", "audio/mpeg");
        await admin.from("imphq_studio_generations").update({ status: "completed", output_url: publicUrl }).eq("id", row.id);
        return new Response(JSON.stringify({ ok: true, id: row.id, output_url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      throw new Error(`Combinação não suportada: ${kind}/${provider}`);
    } catch (genErr: any) {
      console.error("studio-generate error:", genErr);
      await admin.from("imphq_studio_generations").update({ status: "failed", error: String(genErr?.message || genErr).slice(0, 1000) }).eq("id", row.id);
      return new Response(JSON.stringify({ ok: false, id: row.id, error: String(genErr?.message || genErr) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e: any) {
    console.error("studio-generate fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

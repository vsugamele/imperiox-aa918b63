// Referencia Video Transcribe — baixa o vídeo da URL salva em imphq_referencias e
// envia para o Lovable AI Gateway (gpt-4o-mini-transcribe). Persiste em
// `transcricao` + `transcribe_status` na linha correspondente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_BYTES = 24 * 1024 * 1024; // 24MB cap do Gateway

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const refId: string | undefined = body.referencia_id;
    if (!refId) {
      return new Response(JSON.stringify({ error: "referencia_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ref, error: rErr } = await supabase
      .from("imphq_referencias")
      .select("id, url, image_url, tipo, titulo")
      .eq("id", refId)
      .single();
    if (rErr || !ref) {
      return new Response(JSON.stringify({ error: "referencia not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const videoUrl: string | null = (ref.url || ref.image_url) ?? null;
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "referencia sem url de vídeo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("imphq_referencias")
      .update({ transcribe_status: "processing", transcribe_error: null })
      .eq("id", refId);

    // Baixa o vídeo
    let bytes: Uint8Array;
    let contentType = "video/mp4";
    try {
      const dl = await fetch(videoUrl);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const buf = new Uint8Array(await dl.arrayBuffer());
      if (buf.byteLength === 0) throw new Error("arquivo vazio");
      if (buf.byteLength > MAX_BYTES) {
        const msg = `Arquivo ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB excede 24MB.`;
        await supabase
          .from("imphq_referencias")
          .update({ transcribe_status: "error", transcribe_error: msg })
          .eq("id", refId);
        return new Response(JSON.stringify({ error: msg }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      bytes = buf;
      contentType = dl.headers.get("content-type") || contentType;
    } catch (e: any) {
      const msg = e?.message || "download failed";
      await supabase
        .from("imphq_referencias")
        .update({ transcribe_status: "error", transcribe_error: msg })
        .eq("id", refId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detecta extensão
    const urlExt = (videoUrl.split("?")[0].split(".").pop() || "mp4").toLowerCase();
    const safeExt = ["mp3", "mp4", "wav", "webm", "m4a", "mpga", "mpeg", "ogg", "flac", "mov"].includes(urlExt)
      ? (urlExt === "mov" ? "mp4" : urlExt)
      : "mp4";

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", new Blob([bytes], { type: contentType }), `video.${safeExt}`);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      await supabase
        .from("imphq_referencias")
        .update({ transcribe_status: "error", transcribe_error: `${resp.status}: ${txt.slice(0, 400)}` })
        .eq("id", refId);
      return new Response(JSON.stringify({ error: `transcription failed: ${resp.status}`, detail: txt }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const transcript: string = json.text || "";

    await supabase
      .from("imphq_referencias")
      .update({
        transcricao: transcript,
        transcribe_status: "done",
        transcribe_error: null,
        transcribed_at: new Date().toISOString(),
      })
      .eq("id", refId);

    return new Response(JSON.stringify({ ok: true, transcript, length: transcript.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[referencia-video-transcribe] fatal", e);
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

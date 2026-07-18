// Swipe Video Transcribe — Transcreve vídeo do bucket swipe-media via Lovable AI Gateway STT
// Fluxo: cliente faz upload -> chama esta função com swipe_id -> baixamos do Storage e enviamos
// para /v1/audio/transcriptions (gpt-4o-mini-transcribe). Salvamos transcrição no swipe e
// opcionalmente disparamos swipe-engineer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_BYTES = 24 * 1024 * 1024; // 24MB — abaixo do cap do Gateway (25MiB)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
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
    const swipeId: string | undefined = body.swipe_id;
    const storagePath: string | undefined = body.storage_path;
    const videoUrl: string | undefined = body.video_url;
    const autoEngineer: boolean = !!body.auto_engineer;

    if (!swipeId || (!storagePath && !videoUrl)) {
      return new Response(JSON.stringify({ error: "swipe_id and (storage_path or video_url) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida ownership
    const { data: swipe, error: sErr } = await supabase
      .from("imphq_swipes")
      .select("id, user_id, title")
      .eq("id", swipeId)
      .single();
    if (sErr || !swipe || swipe.user_id !== userId) {
      return new Response(JSON.stringify({ error: "swipe not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("imphq_swipes")
      .update({ transcribe_status: "processing", transcribe_error: null })
      .eq("id", swipeId);

    // Carrega bytes: storage ou URL
    let file: Blob;
    let safeExt = "mp4";
    if (storagePath) {
      const { data: f, error: dErr } = await supabase.storage.from("swipe-media").download(storagePath);
      if (dErr || !f) {
        await supabase
          .from("imphq_swipes")
          .update({ transcribe_status: "error", transcribe_error: dErr?.message || "download failed" })
          .eq("id", swipeId);
        return new Response(JSON.stringify({ error: dErr?.message || "download failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      file = f;
      const ext = (storagePath.split(".").pop() || "mp4").toLowerCase();
      safeExt = ["mp3", "mp4", "wav", "webm", "m4a", "mpga", "mpeg", "ogg", "flac"].includes(ext) ? ext : "mp4";
    } else {
      try {
        const dl = await fetch(videoUrl!);
        if (!dl.ok) throw new Error(`download ${dl.status}`);
        const ct = dl.headers.get("content-type") || "video/mp4";
        const buf = new Uint8Array(await dl.arrayBuffer());
        if (!buf.byteLength) throw new Error("arquivo vazio");
        if (buf.byteLength > MAX_BYTES) throw new Error(`Arquivo ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB excede 24MB.`);
        file = new Blob([buf], { type: ct });
        const urlExt = (videoUrl!.split("?")[0].split(".").pop() || "mp4").toLowerCase();
        safeExt = ["mp3", "mp4", "wav", "webm", "m4a", "mpga", "mpeg", "ogg", "flac", "mov"].includes(urlExt)
          ? (urlExt === "mov" ? "mp4" : urlExt)
          : "mp4";
      } catch (e: any) {
        const msg = e?.message || "download failed";
        await supabase
          .from("imphq_swipes")
          .update({ transcribe_status: "error", transcribe_error: msg })
          .eq("id", swipeId);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (file.size > MAX_BYTES) {
      const msg = `Arquivo ${(file.size / 1024 / 1024).toFixed(1)}MB excede 24MB. Comprima ou divida o vídeo.`;
      await supabase
        .from("imphq_swipes")
        .update({ transcribe_status: "error", transcribe_error: msg })
        .eq("id", swipeId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // safeExt já foi definido acima conforme storage_path ou video_url

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", file, `recording.${safeExt}`);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      await supabase
        .from("imphq_swipes")
        .update({ transcribe_status: "error", transcribe_error: `${resp.status}: ${txt.slice(0, 400)}` })
        .eq("id", swipeId);
      return new Response(JSON.stringify({ error: `transcription failed: ${resp.status}`, detail: txt }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const transcript: string = json.text || "";

    // Merge no swipe — atualiza raw_text e blocks.narrativa se vazio
    const { data: cur } = await supabase
      .from("imphq_swipes")
      .select("blocks, raw_text")
      .eq("id", swipeId)
      .single();
    const blocks = (cur?.blocks as any) || {};
    if (!blocks.narrativa) blocks.narrativa = transcript;

    await supabase
      .from("imphq_swipes")
      .update({
        raw_text: transcript,
        blocks,
        transcribe_status: "done",
        transcribe_error: null,
      })
      .eq("id", swipeId);

    // Fire-and-forget: dispara engenharia reversa
    if (autoEngineer) {
      fetch(`${SUPABASE_URL}/functions/v1/swipe-engineer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ swipe_id: swipeId }),
      }).catch((e) => console.error("[swipe-video-transcribe] engineer trigger failed", e));
    }

    return new Response(JSON.stringify({ ok: true, transcript_length: transcript.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[swipe-video-transcribe] fatal", e);
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { message_id, media_url, project_id, conversation_id, lead_id, phone, force } = body || {};

    if (!message_id || !media_url) {
      return new Response(JSON.stringify({ error: "message_id e media_url são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ELEVENLABS_API_KEY) {
      console.warn("[wa-audio-transcribe] ELEVENLABS_API_KEY não configurada");
      return new Response(JSON.stringify({ skipped: "no_api_key" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotência: só transcreve se ainda não tem transcript (a não ser que force=true)
    if (!force) {
      const { data: existing } = await supabase
        .from("imphq_wa_messages")
        .select("transcript")
        .eq("id", message_id)
        .maybeSingle();
      if (existing?.transcript) {
        return new Response(JSON.stringify({ skipped: "already_transcribed", transcript: existing.transcript }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[wa-audio-transcribe] Transcribing ${message_id} from ${media_url}`);
    const audioFetch = await fetch(media_url);
    if (!audioFetch.ok) {
      console.error(`[wa-audio-transcribe] Falha ao baixar áudio: ${audioFetch.status}`);
      return new Response(JSON.stringify({ error: "fetch_audio_failed", status: audioFetch.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const audioBlob = await audioFetch.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "por");
    formData.append("tag_audio_events", "false");
    formData.append("diarize", "false");

    const sttRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: formData,
    });

    if (!sttRes.ok) {
      const errTxt = await sttRes.text().catch(() => "");
      console.error(`[wa-audio-transcribe] ElevenLabs STT ${sttRes.status}: ${errTxt}`);
      return new Response(JSON.stringify({ error: "stt_failed", status: sttRes.status, details: errTxt }), {
        status: sttRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sttData = await sttRes.json();
    const transcript = ((sttData?.text as string) || "").trim();

    if (!transcript) {
      console.warn(`[wa-audio-transcribe] Transcript vazio para ${message_id}`);
      return new Response(JSON.stringify({ skipped: "empty_transcript" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await supabase
      .from("imphq_wa_messages")
      .update({ transcript })
      .eq("id", message_id);

    if (upErr) {
      console.error(`[wa-audio-transcribe] DB update error: ${upErr.message}`);
    } else {
      console.log(`[wa-audio-transcribe] ✅ ${message_id}: "${transcript.slice(0, 80)}"`);
    }

    // Indexa memória do lead (best-effort)
    if (project_id && phone && transcript) {
      try {
        const embedding = await getCachedEmbedding(supabase, transcript);
        if (embedding) {
          await supabase.from("imphq_wa_lead_memory").insert({
            lead_id: lead_id || null,
            project_id,
            phone,
            content: `[Áudio] ${transcript}`,
            embedding,
          });
        }
      } catch (embErr: any) {
        console.warn("[wa-audio-transcribe] embedding skip:", embErr?.message);
      }
    }

    return new Response(JSON.stringify({ success: true, transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[wa-audio-transcribe] fatal:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

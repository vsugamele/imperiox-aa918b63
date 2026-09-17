import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEDIA_BUCKET = "linfaflow-care-media";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY") || "";
const ELEVENLABS_VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM";

function getClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cleanVoiceText(value: string) {
  return String(value || "")
    .replace(/https?:\/\/\S+/g, "secure checkout link")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1400);
}

function cleanCacheKey(value: string) {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return cleaned || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, session_id, cache_key } = await req.json().catch(() => ({}));
    const voiceText = cleanVoiceText(text);
    const cacheKey = cleanCacheKey(cache_key);
    if (!voiceText) {
      return new Response(JSON.stringify({ ok: false, error: "missing_text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "missing_elevenlabs_key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getClient();
    if (!supabase) {
      return new Response(JSON.stringify({ ok: false, error: "storage_unavailable" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.storage.createBucket(MEDIA_BUCKET, { public: false }).catch(() => null);

    const cachedPath = cacheKey ? `voice-cache/${cacheKey}.mp3` : "";
    if (cachedPath) {
      const { data: cachedSigned, error: cachedError } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(cachedPath, 60 * 60 * 24);
      if (!cachedError && cachedSigned?.signedUrl) {
        return new Response(JSON.stringify({
          ok: true,
          audio_url: cachedSigned.signedUrl,
          storage_path: cachedPath,
          provider: "elevenlabs",
          cache_hit: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: voiceText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.52,
          similarity_boost: 0.74,
          style: 0.18,
          use_speaker_boost: true,
        },
      }),
    });

    if (!ttsResponse.ok) {
      const detail = await ttsResponse.text().catch(() => "");
      console.error("[linfaflow-care-voice] ElevenLabs error", ttsResponse.status, detail.slice(0, 400));
      return new Response(JSON.stringify({ ok: false, error: "tts_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBlob = await ttsResponse.blob();
    const sessionPart = String(session_id || "anonymous").replace(/[^a-z0-9-]+/gi, "-").slice(0, 80);
    const path = cachedPath || `${sessionPart}/voice-${Date.now()}-${crypto.randomUUID()}.mp3`;
    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, audioBlob, {
      contentType: "audio/mpeg",
      cacheControl: "3600",
      upsert: Boolean(cachedPath),
    });
    if (uploadError) throw uploadError;

    const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, cachedPath ? 60 * 60 * 24 : 60 * 60 * 6);

    return new Response(JSON.stringify({
      ok: true,
      audio_url: signed?.signedUrl || "",
      storage_path: path,
      provider: "elevenlabs",
      cache_hit: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[linfaflow-care-voice] error", error?.message || error);
    return new Response(JSON.stringify({ ok: false, error: "voice_error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

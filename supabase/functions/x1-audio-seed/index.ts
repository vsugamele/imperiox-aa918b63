// Gera os 4 áudios do funil LinfaFlow X1 no ElevenLabs (voz Brian, EN-US) e
// publica no bucket público `whatsapp-media` em x1/audio/.
// Idempotente: sempre escreve os mesmos 4 nomes de arquivo, com roteiros fixos.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const VOICE = "nPczCjzI2devNBz1zQrb"; // Brian

const SCRIPTS: Record<string, string[]> = {
  audio_ritual: [
    "Can I tell you what changed how I think about this? For years I treated the swelling like a water problem. Drink less, salt less, take a pill, push the water out. But your body isn't holding water because it has too much. It's holding it because the drainage is slow.",
    "Compression, massage, elevation — those all work from the outside, and only for a few hours. LINFAFLOW works the other direction. Four botanicals, each one doing a different job: one to get circulation moving, two to help mobilize what feels stuck, one to support daily balance. Liquid drops, one dropper in the morning, one at night. Thirty seconds at your sink.",
    "It's not a cleanse. It's not a water pill. It's support for something your body already knows how to do.",
  ],
  audio_inercia: [
    "I want to say one honest thing and then I'll leave you alone. The reason I keep coming back to this isn't the bottle. It's that nothing about slow drainage fixes itself. Twelve months from now, the mornings look the same, the ankles look the same, and someone tells you again that your labs are normal.",
    "You already tried the things that work from the outside. This is thirty seconds a day, for thirty days, with a full refund if your mornings don't feel different. You're not deciding whether it works. You're deciding to find out.",
  ],
  audio_objecao_preco: [
    "I get it, and I'm not going to pretend it's free. So let's just do the math out loud. One drainage session is eighty to a hundred and fifty dollars, and most people book two a month. Compression socks wear out. The pumps start at two thousand. This is one bottle, thirty days of daily support, and if your mornings don't feel different you send it back and you're out nothing. That's not a price question anymore. That's a thirty-day question.",
  ],
  audio_tentei_tudo: [
    "I hear this a lot: I've tried everything. And you probably have. But look at the list — socks, massage, brushing, elevation, teas. Every single one of those is outside-in, or it forces water out. Not one of them supports the flow itself. This isn't a stronger version of what you tried. It's a different category. And with the thirty-day guarantee, you're not the one taking the risk.",
  ],
};

async function tts(apiKey: string, text: string, prev?: string, next?: string) {
  const body: Record<string, unknown> = {
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.15,
      use_speaker_boost: true,
      speed: 1.0,
    },
  };
  if (prev) body.previous_text = prev;
  if (next) body.next_text = next;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[${res.status}]: ${err}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: Record<string, string> = {};

    for (const [name, paras] of Object.entries(SCRIPTS)) {
      const parts: Uint8Array[] = [];
      for (let i = 0; i < paras.length; i++) {
        parts.push(await tts(apiKey, paras[i], paras[i - 1], paras[i + 1]));
      }
      const total = parts.reduce((n, p) => n + p.length, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { merged.set(p, off); off += p.length; }

      const path = `x1/audio/${name}.mp3`;
      const { error } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, merged, { contentType: "audio/mpeg", upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);

      results[name] = supabase.storage.from("whatsapp-media").getPublicUrl(path).data.publicUrl;
      console.log(`${name}: ${Math.round(total / 1024)} KB -> ${path}`);
    }

    return new Response(JSON.stringify({ ok: true, urls: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("x1-audio-seed:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

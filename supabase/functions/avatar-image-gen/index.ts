// Streaming image generation using Gemini 3.1 Flash Image (Nano Banana 2)
// with avatar reference photos. Forwards SSE from Lovable AI Gateway.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    prompt: string;
    reference_urls?: string[];
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const refs = (body.reference_urls || []).filter((u) => typeof u === "string" && u).slice(0, 6);
  const model = body.model || "google/gemini-3.1-flash-image";

  const content: any[] = [{ type: "text", text: prompt }];
  for (const url of refs) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const upstream = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `upstream ${upstream.status}: ${errText.slice(0, 500)}` }),
      { status: upstream.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

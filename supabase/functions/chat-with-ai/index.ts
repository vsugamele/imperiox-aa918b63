import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { messages, model: requestedModel } = body;
    const model = requestedModel || "google/gemini-2.5-flash";

    // Detect if model is a Lovable model
    const isLovableModel = model.startsWith("google/") || model.startsWith("openai/");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (isLovableModel && !LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured in Supabase secrets");
    }
    if (!isLovableModel && !OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not configured in Supabase secrets");
    }

    const aiBaseUrl = isLovableModel ? "https://ai.gateway.lovable.dev/v1" : "https://openrouter.ai/api/v1";
    const aiApiKey = isLovableModel ? LOVABLE_API_KEY! : OPENROUTER_API_KEY!;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${aiApiKey}`,
      "Content-Type": "application/json",
    };

    if (!isLovableModel) {
      headers["HTTP-Referer"] = "https://imperiox.lovable.app";
      headers["X-Title"] = "ImperioHQ";
    }

    console.log(`[chat-with-ai] Forwarding request to ${aiBaseUrl}/chat/completions model=${model}`);
    const upstreamResponse = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      console.error(`[chat-with-ai] AI Gateway error: ${upstreamResponse.status} - ${errorText}`);
      return new Response(JSON.stringify({ error: errorText }), {
        status: upstreamResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstreamResponse.json();
    console.log(`[chat-with-ai] Successfully received response from AI Gateway`);
    
    const reply = data.choices?.[0]?.message?.content || "";
    const responsePayload = {
      choices: data.choices || [{ message: { content: reply } }],
      content: reply
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[chat-with-ai] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

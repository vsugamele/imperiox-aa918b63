// Lista dinâmica de modelos do OpenRouter com cache em memória (1h)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let CACHE: { ts: number; data: any[] } | null = null;
const TTL_MS = 60 * 60 * 1000; // 1h

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const now = Date.now();
    if (!CACHE || now - CACHE.ts > TTL_MS) {
      const res = await fetch("https://openrouter.ai/api/v1/models");
      if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
      const json = await res.json();
      const models = (json.data || []).map((m: any) => {
        const promptPrice = Number(m.pricing?.prompt || 0);
        const completionPrice = Number(m.pricing?.completion || 0);
        // tier baseado em preço ($/1M tokens)
        const avgPrice = ((promptPrice + completionPrice) / 2) * 1_000_000;
        let tier: "free" | "cheap" | "mid" | "premium" = "cheap";
        if (avgPrice === 0) tier = "free";
        else if (avgPrice < 1) tier = "cheap";
        else if (avgPrice < 10) tier = "mid";
        else tier = "premium";
        return {
          id: m.id,
          name: m.name || m.id,
          context: m.context_length || 0,
          tier,
          price_prompt: promptPrice,
          price_completion: completionPrice,
          description: (m.description || "").slice(0, 200),
        };
      }).sort((a: any, b: any) => a.name.localeCompare(b.name));
      CACHE = { ts: now, data: models };
    }

    return new Response(JSON.stringify({ models: CACHE.data, cached_at: CACHE.ts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e), models: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

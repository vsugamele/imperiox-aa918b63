import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { model_id, output_type, briefing } = await req.json();
    if (!model_id) return new Response(JSON.stringify({ error: "model_id required" }), { status: 400, headers: corsHeaders });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: model, error } = await sb.from("imphq_studio_reference_models")
      .select("*").eq("id", model_id).eq("user_id", auth.userId).single();
    if (error || !model) return new Response(JSON.stringify({ error: "model not found" }), { status: 404, headers: corsHeaders });

    const finalType = output_type ?? model.output_type ?? "reels";

    const system = `Você é um roteirista/diretor. A partir da ficha de modelagem, gere um STORYBOARD replicando a estética. Devolva SOMENTE JSON:
{
  "titulo": "...",
  "output_type": "${finalType}",
  "duracao_total_seg": 30,
  "cenas": [
    { "n": 1, "duracao_seg": 3, "prompt_imagem": "prompt visual detalhado no estilo da referência", "narracao": "voz off / diálogo", "on_screen_text": "texto na tela", "acao": "descrição da ação/movimento" }
  ],
  "cta_final": "..."
}
Cenas: 4-8 para reels, 6-12 para VSL, 5-8 slides para carrossel, 1 para imagem.`;

    const userMsg = `FICHA DE MODELAGEM:\n${JSON.stringify(model.ficha, null, 2)}\n\nBRIEFING: ${briefing ?? "seguir a ficha"}\n\nTipo de saída: ${finalType}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: "AI error", detail: txt }), { status: r.status, headers: corsHeaders });
    }
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    let storyboard: any = {};
    try { storyboard = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { storyboard = { erro: "parse", raw }; }

    await sb.from("imphq_studio_reference_models").update({
      storyboard, output_type: finalType, status: "storyboarded",
    }).eq("id", model_id).eq("user_id", auth.userId);

    return new Response(JSON.stringify({ storyboard }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

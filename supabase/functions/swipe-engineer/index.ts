// Swipe File — Engenharia reversa (extrai esqueleto + gatilhos + fórmula)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { swipe_id } = await req.json();
    const { data: swipe, error } = await supabase.from("imphq_swipes").select("*").eq("id", swipe_id).eq("user_id", user.id).single();
    if (error || !swipe) throw new Error("Swipe não encontrado");

    const blocksText = JSON.stringify(swipe.blocks, null, 2);

    const prompt = `Você é um engenheiro reverso de copys. Analise a copy abaixo e devolva APENAS JSON válido (sem markdown) seguindo este esquema:

{
  "formula_nome": "nome curto e memorável da fórmula (ex: 'Segredo Duplo + Prova Real + CTA Comentário')",
  "esqueleto": {
    "gancho": "template do gancho com placeholders {produto}, {dor}, {numero}, {nicho}, {prova}",
    "participacao_ativa": "template",
    "narrativa": "template em 2-4 parágrafos com placeholders",
    "reframe": "template",
    "cta_engajamento": "template",
    "cta_venda": "template"
  },
  "gatilhos": ["array de gatilhos psicológicos: escassez, prova social, curiosidade, autoridade, reciprocidade, etc."],
  "publico_alvo": "descrição em 1 linha do avatar dessa copy",
  "tom_voz": "descrição do tom (íntimo/autoritário/místico/etc)",
  "ritmo": "descrição do ritmo (curto e seco / longo narrativo / etc)",
  "observacoes": "1-2 linhas de o que torna essa copy efetiva"
}

COPY ORIGINAL:
Título: ${swipe.title}
Mecanismo declarado: ${swipe.mecanismo || "não informado"}
Plataforma: ${swipe.plataforma || "n/a"}
Formato: ${swipe.formato || "n/a"}

Blocos:
${blocksText}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você disseca copys de marketing direto e devolve estruturas reutilizáveis. Sempre JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
    const aiData = await aiRes.json();
    const reverse = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");

    await supabase.from("imphq_swipes").update({ reverse_engineering: reverse }).eq("id", swipe_id);

    return new Response(JSON.stringify({ ok: true, reverse_engineering: reverse }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[swipe-engineer]", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

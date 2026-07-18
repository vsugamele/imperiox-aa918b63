// Swipe File — Engenharia reversa rica
// Detecta schema VSL (vsl7) vs curto (short6) e aplica prompt específico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SHORT_PROMPT_SCHEMA = `{
  "formula_nome": "nome curto e memorável da fórmula",
  "esqueleto": {
    "gancho": "template com {placeholders}",
    "participacao_ativa": "...",
    "narrativa": "...",
    "reframe": "...",
    "cta_engajamento": "...",
    "cta_venda": "..."
  },
  "gatilhos": ["..."],
  "publico_alvo": "...",
  "tom_voz": "...",
  "ritmo": "...",
  "observacoes": "..."
}`;

const VSL_PROMPT_SCHEMA = `{
  "formula_nome": "nome memorável da estrutura desta VSL",
  "promessa_central": "1 frase que sintetiza a promessa principal",
  "publico_alvo": { "dor": "...", "desejo": "...", "objecao_principal": "..." },
  "mecanismo_unico": { "nome": "...", "analogia": "...", "pilares": ["pilar 1","pilar 2","pilar 3"], "por_que_concorrencia_falha": "..." },
  "escada_ancoragem": { "valor_real": "R$ X — racional", "custo_criacao": "...", "preco_mercado": "...", "preco_final": "..." },
  "bonus_mapeados": [ { "nome": "...", "objecao_que_mata": "..." } ],
  "garantia": { "tipo": "incondicional|condicional|risco invertido", "prazo": "...", "framing": "..." },
  "esqueleto_vsl7": {
    "b1_gancho": "template do bloco 1 com {placeholders} ({nicho}, {dor}, {numero}, {avatar}, {prova})",
    "b2_agitacao": "template do bloco 2",
    "b3_origem": "template do bloco 3 (origin story em 5 batidas)",
    "b4_mecanismo": "template do bloco 4",
    "b5_oferta": "template do bloco 5 com escada de ancoragem",
    "b6_value_stack": "template do bloco 6",
    "b7_garantia_cta": "template do bloco 7"
  },
  "gatilhos": ["lista de gatilhos psicológicos centrais"],
  "tom_voz": "...",
  "ritmo": "...",
  "observacoes": "1-3 linhas sobre o que faz esta VSL converter"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
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

    const blocks = swipe.blocks || {};
    const isVsl = blocks.__schema === "vsl7" || (swipe.formato || "").toLowerCase() === "vsl";
    const schema = isVsl ? VSL_PROMPT_SCHEMA : SHORT_PROMPT_SCHEMA;

    const blocksText = JSON.stringify(blocks, null, 2);
    const rawSample = swipe.raw_text ? `\n\nTRANSCRIÇÃO BRUTA (amostra):\n${swipe.raw_text.slice(0, 12000)}` : "";

    const prompt = `Você é um engenheiro reverso ${isVsl ? "de VSLs de alto ticket" : "de copys curtas"}. Analise a copy abaixo e devolva APENAS JSON válido (sem markdown) seguindo este esquema:

${schema}

COPY ORIGINAL:
Título: ${swipe.title}
Mecanismo declarado: ${swipe.mecanismo || "não informado"}
Plataforma: ${swipe.plataforma || "n/a"}
Formato: ${swipe.formato || "n/a"}

Blocos:
${blocksText}${rawSample}`;

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
    reverse.__schema = isVsl ? "vsl7" : "short6";

    await supabase.from("imphq_swipes").update({ reverse_engineering: reverse }).eq("id", swipe_id);

    return new Response(JSON.stringify({ ok: true, reverse_engineering: reverse }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[swipe-engineer]", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

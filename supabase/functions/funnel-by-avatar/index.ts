// Funnel by Avatar — adapta o funil ao perfil exato do avatar (consciência, temperatura, persona)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id, product, consciencia, temperatura, persona_extra } = await req.json();
    if (!project_id || !product) {
      return new Response(JSON.stringify({ error: "project_id e product obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: proj } = await sb.from("imphq_projects").select("data, nome").eq("id", project_id).maybeSingle();
    const d = (proj as any)?.data || {};
    const avatar = d.avatar || d.avatars_por_produto;
    const branding = d.branding || d.brand;

    const sys = `Você é o Imperius Avatar-Funnel Strategist. Você desenha o funil EXATO para um perfil de avatar específico — conhecendo nível de consciência (Schwartz: inconsciente → consciente do problema → consciente da solução → consciente do produto → mais consciente) e temperatura (frio/morno/quente).

Sua entrega é prescritiva: ativos certos na ordem certa, com copy adaptada ao estado mental real do avatar.`;

    const usr = `PROJETO: ${(proj as any)?.nome || project_id}
PRODUTO: ${product?.nome || product?.name} (R$ ${product?.preco_por || product?.preco || "—"})
AVATAR BASE: ${typeof avatar === "string" ? avatar : JSON.stringify(avatar || {}).slice(0, 1500)}
BRANDING: ${JSON.stringify(branding || {}).slice(0, 500)}

PARÂMETROS DO FUNIL ALVO:
- Nível de consciência: ${consciencia || "consciente do problema"}
- Temperatura: ${temperatura || "morno"}
- Persona adicional: ${persona_extra || "—"}

Retorne JSON estrito:
{
  "diagnostico": "1 parágrafo: por que esse avatar precisa de um funil diferente do padrão",
  "estrategia_central": "1 frase: o ângulo dominante",
  "jornada_recomendada": [
    { "etapa": "topo|meio|fundo|pós", "ativo": "VSL|LP|Quiz|Webinar|Sequência email|Anúncio|...", "porque": "1 frase", "copy_chave": "headline ou abertura específica" }
  ],
  "ativos_essenciais": ["lista de 5-8 nomes de ativos do funil"],
  "ativos_evitar": ["o que NÃO usar e por quê"],
  "gatilhos_principais": ["3-5 gatilhos psicológicos prioritários"],
  "tom_voz": "como falar com esse perfil",
  "objecoes_chave": ["top 3 objeções deste perfil"],
  "metricas_alvo": { "ctr_estimado": "%", "conversao_estimada": "%", "ticket_recomendado": "R$X" }
}

Português BR. Seja específico — nada genérico.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI failed", detail: txt }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await aiRes.json();
    const content = j?.choices?.[0]?.message?.content || "{}";
    let result: any = {};
    try { result = JSON.parse(content); } catch { result = { raw: content }; }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

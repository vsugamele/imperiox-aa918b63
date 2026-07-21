// Scores a hook/script for viral potential 0-100 using Lovable AI.
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { hook, contexto = "" } = await req.json();
    if (!hook || typeof hook !== "string") {
      return new Response(JSON.stringify({ error: "hook obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `Você é um diretor criativo de performance especializado em hooks virais para Reels, TikTok e anúncios de resposta direta em pt-BR. Avalie o hook em 5 dimensões (0-20 cada, total 0-100):
1. CURIOSIDADE (abre loop mental que exige continuar assistindo)
2. ESPECIFICIDADE (números, nomes, contexto concreto vs genérico)
3. PROMESSA/BENEFÍCIO (o que a pessoa ganha se continuar)
4. CONTRASTE/TENSÃO (padrão vs quebra, esperado vs inesperado)
5. RITMO/BREVIDADE (cabe em 2-3s de leitura, sem gordura)

Responda APENAS com JSON válido (sem markdown, sem code fences):
{
  "score": <0-100>,
  "breakdown": { "curiosidade": <0-20>, "especificidade": <0-20>, "promessa": <0-20>, "contraste": <0-20>, "ritmo": <0-20> },
  "veredito": "<uma linha: 🔥 matador | ✅ bom | ⚠️ mediano | ❌ fraco>",
  "diagnostico": "<2-3 linhas do que está funcionando e o principal ponto fraco>",
  "sugestao": "<UMA reescrita melhorada do hook, curta e direta>"
}`;

    const user = `HOOK/ROTEIRO A AVALIAR:\n${hook}${contexto ? `\n\nCONTEXTO DO PROJETO:\n${contexto.slice(0, 800)}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `AI ${res.status}: ${txt.slice(0, 200)}` }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw = (data?.choices?.[0]?.message?.content || "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      return new Response(JSON.stringify({ error: "resposta inválida da IA", raw }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

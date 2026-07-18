// Refines a hyper-realistic image prompt using Lovable AI Gateway.
import { requireUser } from "../_shared/require-auth.ts";
// Input: { prompt: string, target?: "midjourney"|"dalle"|"firefly"|"sora", briefing?: string }
// Output: { refined: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { prompt, target = "midjourney", briefing = "", mode = "compact" } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetInstructions: Record<string, string> = {
      midjourney: "Otimize para Midjourney v6: termos visuais densos separados por vírgula, foco em fotorrealismo, inclua --ar e --style raw quando fizer sentido. Sem prosa.",
      dalle: "Otimize para DALL·E 3 / GPT Image: linguagem natural rica em detalhes visuais, descritiva em parágrafo único.",
      firefly: "Otimize para Adobe Firefly: descritivo curto, estilo fotográfico, lente e iluminação destacados.",
      sora: "Otimize para vídeo Sora: descreva cena, movimento de câmera, duração implícita e mood.",
    };

    const modeInstructions: Record<string, string> = {
      compact: "Mantenha o formato compacto, termos visuais densos separados por vírgula.",
      editorial: "REESCREVA em UM ÚNICO parágrafo cinematográfico denso e sensorial (estilo Vogue/Lindbergh), mantendo TODOS os tokens técnicos (câmera, lente, f-stop, ISO, filme, iluminação, --ar, --no, --seed). Use linguagem evocativa, ritmo poético, mas sem perder precisão técnica. ~80-140 palavras.",
      json: "Retorne APENAS um objeto JSON válido com chaves: subject, action, environment, lighting, camera, style, params. Sem markdown.",
    };

    const sys = `Você é diretor de arte e prompt engineer especialista em geração de imagens fotorrealistas. Refine o prompt mantendo TODOS os detalhes técnicos (lente, ISO, shutter, filme, iluminação), corrigindo redundâncias e elevando a precisão visual. ${targetInstructions[target] || targetInstructions.midjourney} ${modeInstructions[mode] || modeInstructions.compact} Responda APENAS com o prompt refinado, sem comentários, sem aspas, sem cabeçalhos.`;

    const user = `PROMPT ORIGINAL:\n${prompt}\n${briefing ? `\nBRIEFING DO PROJETO (use como contexto, não copie):\n${briefing}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
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
    const refined = (data?.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ refined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

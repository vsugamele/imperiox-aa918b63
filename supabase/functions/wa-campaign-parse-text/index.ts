import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { text, base_date } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseStr = base_date || new Date().toISOString().slice(0, 10);

    const systemPrompt = `Você é um parser de sequências de mensagens WhatsApp em pt-BR.
Recebe um copy bruto com blocos separados por linhas tipo "—----" ou "----".
Cada bloco começa com um cabeçalho indicando dia/horário (ex: "Sexta - 22/05 - 9:00", "Sábado 23/05 - 9h", "Domingo - 24/05 - 20:00", "TERÇA — 18H", "DOMINGO — 30 MINUTOS DEPOIS").
Sua tarefa:
1. Separar cada mensagem.
2. Calcular day_offset (inteiro, 0 = data base) a partir da data base fornecida e da data do cabeçalho.
3. Normalizar send_time para "HH:MM" (24h). "9:00" -> "09:00", "20h" -> "20:00", "9h00" -> "09:00".
4. Quando houver apenas dia da semana sem data (ex "SEGUNDA — 08H"), continue contando a partir do último dia conhecido.
5. Quando o cabeçalho diz "30 MINUTOS DEPOIS" ou "1 HORA DEPOIS", manter o mesmo day_offset e somar tempo ao último send_time.
6. content = TEXTO EXATO DA MENSAGEM, **PRESERVANDO LINHAS EM BRANCO ENTRE PARÁGRAFOS** (use "\\n\\n" no JSON). NÃO colapse múltiplas quebras de linha em uma só. NÃO remova espaçamento interno. Preserve emojis, *negrito*, listas e links.
   Exemplo: se o input tem "Fala, tatuador! 👊\\n\\n\\n\\nBem-vindo ao grupo." você deve retornar "Fala, tatuador! 👊\\n\\nBem-vindo ao grupo." (normaliza 3+ \\n para \\n\\n, mas SEMPRE mantém ao menos \\n\\n entre parágrafos).
7. NÃO inclua o cabeçalho de data no content.
8. Se um bloco for instrução metadados (ex "Fazer uma Enquete", "(enviar guia)"), pule (não vire mensagem).
9. Retorne TODOS os blocos, mesmo que sejam 30+.`;

    const userPrompt = `Data base (day_offset=0): ${baseStr}\n\nCopy bruto:\n\n${text}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_sequence",
            description: "Extrai sequência de mensagens WhatsApp",
            parameters: {
              type: "object",
              properties: {
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day_label: { type: "string", description: "Cabeçalho original (ex: 'Sábado 23/05 - 9:00')" },
                      day_offset: { type: "integer", description: "Dias após data base" },
                      send_time: { type: "string", description: "HH:MM 24h" },
                      content: { type: "string", description: "Texto da mensagem" },
                    },
                    required: ["day_offset", "send_time", "content"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["steps"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_sequence" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Aguarde 1 min." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados na workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: t.slice(0, 400) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(argsRaw); } catch { parsed = {}; }
    const steps: any[] = Array.isArray(parsed.steps) ? parsed.steps : [];

    // Normalize defensively
    const normalized = steps
      .map((s: any) => ({
        day_label: String(s.day_label || ""),
        day_offset: Number.isInteger(s.day_offset) ? s.day_offset : 0,
        send_time: typeof s.send_time === "string" && /^\d{1,2}:\d{2}/.test(s.send_time)
          ? s.send_time.padStart(5, "0").slice(0, 5)
          : "09:00",
        // Preserve internal blank lines; only strip whitespace/newlines at the edges.
        // Also collapse 3+ consecutive newlines down to exactly \n\n (paragraph break).
        content: String(s.content || "")
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/^[\s\n]+|[\s\n]+$/g, ""),
      }))
      .filter((s) => s.content.length > 0);

    return new Response(JSON.stringify({ ok: true, steps: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

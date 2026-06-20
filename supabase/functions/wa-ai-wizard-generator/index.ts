// Edge: wa-ai-wizard-generator
// Recebe 6 respostas do wizard e usa Lovable AI Gateway (Gemini) com structured output
// para gerar um config completo da IA do WhatsApp (persona, tom, instruções, FAQ, gatilhos).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface WizardInput {
  project_id: string;
  produto: string;          // O que você vende
  cliente_ideal: string;    // Quem é seu cliente ideal
  dor_principal: string;    // Maior dor/desejo
  ticket_medio: string;     // Faixa de preço
  tom_marca: string;        // Como sua marca fala
  regras_proibidas: string; // O que a IA NÃO pode fazer/dizer
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as WizardInput;
    if (!body?.project_id || !body?.produto || !body?.cliente_ideal) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em IA conversacional para WhatsApp.
A partir de 6 respostas curtas do dono do negócio, gere a configuração completa de uma IA vendedora/atendente.
Retorne SOMENTE via tool call no formato definido. Português do Brasil, tom humano.`;

    const userPrompt = `Negócio:
- Produto/Serviço: ${body.produto}
- Cliente ideal: ${body.cliente_ideal}
- Dor/desejo principal: ${body.dor_principal}
- Ticket médio: ${body.ticket_medio}
- Tom da marca: ${body.tom_marca}
- Regras/proibições: ${body.regras_proibidas}

Gere a configuração da IA otimizada para conversão e atendimento humanizado.`;

    const tools = [{
      type: "function",
      function: {
        name: "salvar_config_ia",
        description: "Salva a config completa da IA do WhatsApp gerada.",
        parameters: {
          type: "object",
          properties: {
            personality: {
              type: "string",
              enum: ["assistente", "vendedor", "suporte", "consultor"],
              description: "Personalidade principal."
            },
            tone: {
              type: "string",
              enum: ["profissional", "casual", "amigavel"],
              description: "Tom de voz."
            },
            welcome_message: {
              type: "string",
              description: "Primeira mensagem ao novo lead. Humana, curta, 1 pergunta no final."
            },
            custom_instructions: {
              type: "string",
              description: "Instruções detalhadas — papel, objetivo, regras de qualificação, postura comercial, limites éticos, escalação. 4 a 8 linhas."
            },
            escalation_keywords: {
              type: "array",
              items: { type: "string" },
              description: "Palavras que disparam handoff humano."
            },
            banned_phrases: {
              type: "array",
              items: { type: "string" },
              description: "Frases que a IA NUNCA deve dizer (com base nas regras do dono)."
            },
            faq: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pergunta: { type: "string" },
                  resposta: { type: "string" }
                },
                required: ["pergunta", "resposta"]
              },
              description: "5 perguntas frequentes prováveis com respostas prontas."
            },
            closer_mode_enabled: {
              type: "boolean",
              description: "True se for produto vendável (ticket relevante)."
            }
          },
          required: ["personality", "tone", "welcome_message", "custom_instructions", "escalation_keywords", "banned_phrases", "faq", "closer_mode_enabled"]
        }
      }
    }];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "salvar_config_ia" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[wa-ai-wizard-generator] AI gateway error", aiRes.status, txt);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido, tente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos Lovable AI insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha ao gerar configuração." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou configuração estruturada." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, config }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[wa-ai-wizard-generator] error", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, trigger_tipo, num_etapas = 4 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Gather project context
    let projectContext = "";
    if (project_id) {
      const { data: project } = await sb.from("imphq_projects").select("*").eq("id", project_id).single();
      if (project) {
        projectContext += `\n## Projeto: ${project.name}\n`;
        if (project.data) {
          const d = typeof project.data === "string" ? JSON.parse(project.data) : project.data;
          if (d.briefing) projectContext += `Briefing: ${JSON.stringify(d.briefing).slice(0, 800)}\n`;
          if (d.avatar) projectContext += `Avatar: ${JSON.stringify(d.avatar).slice(0, 800)}\n`;
          if (d.produtos) projectContext += `Produtos: ${JSON.stringify(d.produtos).slice(0, 500)}\n`;
        }
      }

      // Get products from sales
      const { data: vendas } = await sb.from("imphq_vendas").select("produto_nome, valor").eq("project_id", project_id).limit(10);
      if (vendas && vendas.length > 0) {
        const produtos = [...new Set(vendas.map((v: any) => v.produto_nome).filter(Boolean))];
        if (produtos.length > 0) projectContext += `Produtos vendidos: ${produtos.join(", ")}\n`;
      }
    }

    const triggerLabels: Record<string, string> = {
      carrinho_abandonado: "Carrinho Abandonado — o lead iniciou checkout mas não concluiu",
      compra_aprovada: "Compra Aprovada — o lead acabou de comprar",
      lead_novo: "Novo Lead — acabou de se cadastrar/capturar",
      reembolso: "Reembolso — o cliente pediu reembolso",
    };

    const systemPrompt = `Você é um copywriter brasileiro especialista em automações de marketing digital e sequências multicanal (email, WhatsApp, Telegram).

Seu objetivo: criar uma sequência de ${num_etapas} mensagens para a automação de "${triggerLabels[trigger_tipo] || trigger_tipo}".

${projectContext ? `Contexto do projeto:\n${projectContext}` : ""}

REGRAS:
- Use linguagem conversacional e persuasiva em português brasileiro
- Cada mensagem deve ter um propósito claro (engajamento, urgência, prova social, escassez)
- Intercale canais diferentes quando possível (email para conteúdo longo, WhatsApp para urgência)
- Inclua delays realistas entre mensagens (30min para urgência, 24h-48h para nutrição)
- Use variáveis como {{nome}}, {{produto}}, {{link}} nos templates
- Retorne EXATAMENTE o JSON solicitado, sem markdown`;

    const userPrompt = `Gere uma sequência de ${num_etapas} ações para o trigger "${trigger_tipo}".

Retorne um JSON array com objetos no formato:
[
  { "tipo": "email|whatsapp|telegram|aguardar", "template": "texto da mensagem (ou vazio se tipo=aguardar)", "delay_min": número_em_minutos }
]

Para ações do tipo "aguardar", use template vazio e delay_min com o tempo de espera.
Comece com delay_min=0 na primeira ação.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_flow",
              description: "Generate automation flow actions",
              parameters: {
                type: "object",
                properties: {
                  acoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tipo: { type: "string", enum: ["email", "whatsapp", "telegram", "aguardar"] },
                        template: { type: "string" },
                        delay_min: { type: "number" },
                      },
                      required: ["tipo", "template", "delay_min"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["acoes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_flow" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error: " + status);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    let acoes: any[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      acoes = parsed.acoes || [];
    }

    return new Response(JSON.stringify({ acoes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("openflow-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

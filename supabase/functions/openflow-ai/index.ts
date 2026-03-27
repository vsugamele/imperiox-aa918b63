import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { project_id, trigger_tipo, num_etapas = 4, action } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Gather project context
    let projectData: any = {};
    let projectContext = "";
    if (project_id) {
      const { data: project } = await sb.from("imphq_projects").select("*").eq("id", project_id).single();
      if (project) {
        projectData = project;
        projectContext += `\n## Projeto: ${project.name}\n`;
        const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
        if (d.briefing) projectContext += `Briefing: ${JSON.stringify(d.briefing).slice(0, 800)}\n`;
        if (d.avatar) projectContext += `Avatar: ${JSON.stringify(d.avatar).slice(0, 800)}\n`;
        if (d.produtos) projectContext += `Produtos: ${JSON.stringify(d.produtos).slice(0, 500)}\n`;
        
        const avatar = project.avatar || {};
        if (avatar.dores) projectContext += `Dores do Avatar: ${JSON.stringify(avatar.dores).slice(0, 500)}\n`;
        if (avatar.desejos) projectContext += `Desejos do Avatar: ${JSON.stringify(avatar.desejos).slice(0, 500)}\n`;
        if (avatar.problemas) projectContext += `Problemas do Avatar: ${JSON.stringify(avatar.problemas).slice(0, 500)}\n`;
        if (avatar.voyerismos) projectContext += `Voyerismos: ${JSON.stringify(avatar.voyerismos).slice(0, 500)}\n`;
        if (avatar.gatilhos) projectContext += `Gatilhos existentes: ${JSON.stringify(avatar.gatilhos).slice(0, 500)}\n`;
        if (avatar.perfil) projectContext += `Perfil Avatar: ${JSON.stringify(avatar.perfil).slice(0, 500)}\n`;
        
        const bk = project.brand_kit || {};
        if (Object.keys(bk).length > 0) projectContext += `Brand Kit: ${JSON.stringify(bk).slice(0, 800)}\n`;
      }

      const { data: vendas } = await sb.from("imphq_vendas").select("produto_nome, valor").eq("project_id", project_id).limit(10);
      if (vendas && vendas.length > 0) {
        const produtos = [...new Set(vendas.map((v: any) => v.produto_nome).filter(Boolean))];
        if (produtos.length > 0) projectContext += `Produtos vendidos: ${produtos.join(", ")}\n`;
      }
    }

    // Route by action
    if (action === "generate_copy_arsenal") {
      return await handleCopyArsenal(projectContext, LOVABLE_API_KEY);
    }
    if (action === "generate_branding") {
      return await handleBranding(projectContext, LOVABLE_API_KEY);
    }
    if (action === "generate_gatilhos") {
      return await handleGatilhos(projectContext, LOVABLE_API_KEY);
    }

    // Default: automation flow generation
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
      return handleAIError(response);
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

// ── Shared error handler ──
async function handleAIError(response: Response) {
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

// ── Copy Arsenal Generation ──
async function handleCopyArsenal(projectContext: string, apiKey: string) {
  const systemPrompt = `Você é um copywriter brasileiro de alto nível, especialista em marketing direto e persuasão.
Analise o contexto do projeto e gere copy de alta conversão para os 6 blocos do Arsenal de Copy.

${projectContext}

REGRAS:
- Use linguagem persuasiva, emocional e direta
- Cada bloco deve ter variações prontas para uso em anúncios, emails e páginas de venda
- Foque em gatilhos emocionais específicos do avatar
- NÃO use clichês genéricos. Seja específico para este projeto.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Gere o Arsenal de Copy completo para este projeto. Retorne usando a função generate_copy_arsenal." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_copy_arsenal",
          description: "Generate copy arsenal blocks",
          parameters: {
            type: "object",
            properties: {
              promessa: { type: "array", items: { type: "string" }, description: "2-3 variações de Promessa (Desejo + tempo + dor + objeção)" },
              inimigo_comum: { type: "array", items: { type: "string" }, description: "2-3 variações de Inimigo Comum (terceirizar a culpa)" },
              efeito_colateral: { type: "array", items: { type: "string" }, description: "2-3 variações de Efeito Colateral (risco de continuar errado)" },
              oportunidade: { type: "array", items: { type: "string" }, description: "2-3 variações de Oportunidade Escancarada (prova + transformação)" },
              metodo_simplificado: { type: "array", items: { type: "string" }, description: "2-3 variações de Método Simplificado (quebrar objeção de complexidade)" },
              hora_do_show: { type: "array", items: { type: "string" }, description: "2-3 variações de Hora do Show (3 pilares que provam a promessa)" },
            },
            required: ["promessa", "inimigo_comum", "efeito_colateral", "oportunidade", "metodo_simplificado", "hora_do_show"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_copy_arsenal" } },
    }),
  });

  if (!response.ok) return handleAIError(response);

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  let arsenal = {};
  if (toolCall?.function?.arguments) {
    arsenal = JSON.parse(toolCall.function.arguments);
  }

  return new Response(JSON.stringify({ arsenal }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Branding Generation ──
async function handleBranding(projectContext: string, apiKey: string) {
  const systemPrompt = `Você é um estrategista de marca brasileiro especialista em posicionamento, branding e arquétipos de marca.
Analise o contexto do projeto e sugira os elementos de branding.

${projectContext}

REGRAS:
- Escolha o arquétipo mais adequado dentre: heroi, mentor, fora_da_lei, explorador, criador, cuidador, rei, mago, bobo
- Escreva o manifesto em tom emocional e inspirador
- Seja específico para este projeto, não genérico`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analise o projeto e gere sugestões de branding completas." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_branding",
          description: "Generate branding suggestions",
          parameters: {
            type: "object",
            properties: {
              arquetipo: { type: "string", enum: ["heroi", "mentor", "fora_da_lei", "explorador", "criador", "cuidador", "rei", "mago", "bobo"] },
              inimigo_comum: { type: "string", description: "Contra o que a marca luta" },
              mecanismo_chave: { type: "string", description: "Diferencial ou método exclusivo" },
              personalidade: { type: "string", description: "Personalidade da marca como pessoa" },
              manifesto: { type: "string", description: "Manifesto emocional da marca (3-5 parágrafos)" },
              palavras_usa: { type: "array", items: { type: "string" }, description: "5-8 palavras que a marca usa" },
              palavras_evita: { type: "array", items: { type: "string" }, description: "5-8 palavras que a marca evita" },
            },
            required: ["arquetipo", "inimigo_comum", "mecanismo_chave", "personalidade", "manifesto", "palavras_usa", "palavras_evita"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_branding" } },
    }),
  });

  if (!response.ok) return handleAIError(response);

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  let branding = {};
  if (toolCall?.function?.arguments) {
    branding = JSON.parse(toolCall.function.arguments);
  }

  return new Response(JSON.stringify({ branding }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Gatilhos Generation ──
async function handleGatilhos(projectContext: string, apiKey: string) {
  const systemPrompt = `Você é um especialista em psicologia do consumo e copywriting emocional brasileiro.
Analise o avatar, branding e contexto do projeto para gerar gatilhos emocionais poderosos e um storyboard narrativo.

${projectContext}

REGRAS:
- Gere 5-7 gatilhos emocionais específicos (não genéricos)
- Cada gatilho deve ter nome, categoria emocional, intensidade, situação que ativa e copy sugerido
- O storyboard deve seguir as 5 fases: Antes, Trigger, Busca, Objeção, Decisão
- Gere também o Gatilho Nuclear, The High, The Hell e o Segredo Final`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analise o avatar e gere gatilhos emocionais + storyboard narrativo completo." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_gatilhos",
          description: "Generate emotional triggers and storyboard",
          parameters: {
            type: "object",
            properties: {
              gatilhos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    categoria: { type: "string" },
                    intensidade: { type: "string" },
                    situacao: { type: "string" },
                    copy_sugerido: { type: "string" },
                  },
                  required: ["nome", "categoria", "intensidade", "situacao", "copy_sugerido"],
                  additionalProperties: false,
                },
              },
              storyboard: {
                type: "object",
                properties: {
                  antes: { type: "string" },
                  trigger: { type: "string" },
                  busca: { type: "string" },
                  objecao: { type: "string" },
                  decisao: { type: "string" },
                },
                required: ["antes", "trigger", "busca", "objecao", "decisao"],
                additionalProperties: false,
              },
              gatilho_nuclear: { type: "string" },
              the_high: { type: "string" },
              the_hell: { type: "string" },
              segredo_final: { type: "string" },
            },
            required: ["gatilhos", "storyboard", "gatilho_nuclear", "the_high", "the_hell", "segredo_final"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_gatilhos" } },
    }),
  });

  if (!response.ok) return handleAIError(response);

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  let gatilhos = {};
  if (toolCall?.function?.arguments) {
    gatilhos = JSON.parse(toolCall.function.arguments);
  }

  return new Response(JSON.stringify({ gatilhos }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

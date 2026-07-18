// Gera um FlowBlueprint completo a partir do briefing do produto.
// Usa Gemini para estruturar fluxo + dispara jobs assíncronos para imagens.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireUser } from "../_shared/require-auth.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BRIEF_BY_OBJETIVO: Record<string, string> = {
  quiz: 'Quiz interativo de qualificação tipo Typebot. 4-6 perguntas curtas (choice ou text input), entremeadas por mensagens de empatia e prova social. Termina com diagnóstico personalizado + CTA para checkout/agenda.',
  vsl: 'Roteiro de VSL em blocos sequenciais: Hook (3s), Quebra de padrão, História/Dor, Mecanismo único, Prova, Oferta, Urgência, CTA. Inclua 4-6 cenas com image_prompt para gerar visuais.',
  chat_qualificacao: 'Chat de qualificação consultivo. Saudação, descobre dor/momento, mapeia objeções (preço, tempo, ceticismo), sugere produto ideal, encaminha para humano se quente.',
  pitch: 'Pitch direto de venda: hook visual + dor amplificada + solução + prova + oferta + bônus + garantia + escassez + CTA. Tom Sugamele conversacional.',
  x1_vendas: `Fluxo de atendimento 1:1 no WhatsApp para vendas consultivas (Sugamele). Estágios obrigatórios em sequência, cada um vira 1-2 nodes:
1) ABERTURA — quebra-gelo curto, valida quem é, agradece interesse (sem ser comercial). Use input_text se faltar nome.
2) DIAGNÓSTICO — 2-3 perguntas abertas via input_text/input_choice mapeando momento, dor principal e nível atual.
3) DOR AMPLIFICADA — espelha a resposta com empatia, mostra custo de não agir, micro-história ou prova social curta.
4) APRESENTAÇÃO DA SOLUÇÃO — conecta a dor ao mecanismo único do produto, ainda sem preço. 1 mensagem por ideia.
5) PITCH + LINK — envia oferta (bônus/garantia/escassez se houver) e redirect com {{link_checkout}}.
6) OBJEÇÕES — bifurcações (condition/choice) para preço, tempo, ceticismo, parcelamento. Cada objeção tem resposta curta + CTA reforçado.
7) FOLLOW-UP — wait de 30min, pergunta consultiva ("ficou alguma dúvida?", "quer ver opção mais barata?"), oferta de produto de entrada.
8) HANDOFF — webhook/redirect para humano se lead quente, ou tag fria se silêncio.
Use blocos type:"wait" entre estágios. Inclua condition para variável "respondeu". Não use blocos image (canal WhatsApp 1:1 prioriza texto curto).`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { project_id, produto_nome, produto_id, objetivo, tom, canal } = await req.json();
    if (!project_id || !objetivo) {
      return new Response(JSON.stringify({ error: 'project_id e objetivo são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: project } = await supabase
      .from('imphq_projects')
      .select('name, data')
      .eq('id', project_id)
      .maybeSingle();

    const briefing = (project?.data as any)?.briefing || {};
    const produtos = briefing.produtos || briefing.products || [];
    const produto = produto_nome
      ? produtos.find((p: any) => (p.nome || p.name) === produto_nome) || produtos[0]
      : produtos[0];

    const avatar = (project?.data as any)?.avatar || briefing.avatar || {};
    const branding = (project?.data as any)?.branding || briefing.branding || {};

    const systemPrompt = `Você é arquiteto de funis conversacionais (estilo Typebot). Gera fluxos completos em JSON.

CONTEXTO:
- Projeto: ${project?.name || ''}
- Produto: ${JSON.stringify(produto).slice(0, 800)}
- Avatar: ${JSON.stringify(avatar).slice(0, 800)}
- Branding: ${JSON.stringify(branding).slice(0, 400)}
- Tom solicitado: ${tom || 'conversacional, consultivo, brasileiro'}
- Canal: ${canal || 'web'}

OBJETIVO: ${BRIEF_BY_OBJETIVO[objetivo] || objetivo}

REGRAS DE COPY (Sugamele):
- pt-BR, frases curtas, 1 ideia por mensagem
- não usar "você" repetido, evitar formalismo
- antecipar objeções (preço, tempo, ceticismo) com naturalidade
- CTAs claros e específicos
- toques de prova social e autoridade quando fizer sentido

ESTRUTURA DE SAÍDA (JSON estrito):
{
  "title": "string curta",
  "nodes": [
    {
      "id": "n1",
      "title": "Hook",
      "blocks": [
        { "id": "b1", "type": "text", "text": "..." },
        { "id": "b2", "type": "image", "image_prompt": "descrição visual em inglês para gpt-image-2" },
        { "id": "b3", "type": "input_choice", "text": "Pergunta", "options": ["Opção A", "Opção B"] },
        { "id": "b4", "type": "input_text", "text": "Qual seu nome?", "variable": "nome" },
        { "id": "b5", "type": "condition", "condition": { "variable": "nome", "operator": "is_set" } },
        { "id": "b6", "type": "redirect", "url": "{{link_checkout}}" }
      ]
    }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2" }
  ],
  "variables": [{ "id": "v1", "name": "nome" }]
}

TIPOS DE BLOCO PERMITIDOS: text, image, video, input_text, input_email, input_phone, input_number, input_choice, condition, set_variable, wait, redirect, webhook, ai_prompt.

DIRETRIZES:
- Para "image": gere image_prompt cinematográfico em inglês, mood condizente com a marca.
- Crie 6-12 nodes bem encadeados. Bifurcações em condition/choice quando fizer sentido.
- Não invente links — use placeholders {{link_checkout}}, {{link_agenda}}.

RESPONDA APENAS COM O JSON, SEM MARKDOWN.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Gere o fluxo para o objetivo "${objetivo}".` },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: 'AI Gateway error', detail: errText }), {
        status: aiResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || '{}';
    let blueprint: any;
    try { blueprint = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      blueprint = m ? JSON.parse(m[0]) : { nodes: [], edges: [], variables: [] };
    }

    // Auto-layout
    const COL_W = 380, ROW_H = 240;
    const nodes = (blueprint.nodes || []).map((n: any, i: number) => ({
      ...n,
      x: 200 + (i % 4) * COL_W,
      y: 200 + Math.floor(i / 4) * ROW_H,
      blocks: n.blocks || [],
    }));
    blueprint.nodes = nodes;
    blueprint.edges = blueprint.edges || [];
    blueprint.variables = blueprint.variables || [];
    if (!blueprint.start_node_id && nodes[0]) blueprint.start_node_id = nodes[0].id;

    // Persistir
    const { data: saved, error: insErr } = await supabase
      .from('imphq_flow_blueprints')
      .insert({
        project_id,
        produto_id: produto_id || null,
        produto_nome: produto?.nome || produto?.name || null,
        title: blueprint.title || `Fluxo ${objetivo}`,
        source: 'ai_generated',
        objetivo,
        blueprint,
      })
      .select()
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: 'DB insert', detail: insErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disparar jobs de imagem
    const imageJobs: any[] = [];
    for (const n of nodes) {
      for (const b of (n.blocks || [])) {
        if (b.type === 'image' && b.image_prompt && !b.image_url) {
          imageJobs.push({ blueprint_id: saved.id, block_id: b.id, prompt: b.image_prompt });
        }
      }
    }
    if (imageJobs.length) {
      await supabase.from('imphq_flow_image_jobs').insert(imageJobs);
      // Trigger worker async (fire-and-forget)
      fetch(`${SUPABASE_URL}/functions/v1/flow-image-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ blueprint_id: saved.id }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ blueprint_id: saved.id, image_jobs: imageJobs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

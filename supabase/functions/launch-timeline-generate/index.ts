// Gera cronograma de lançamento via IA a partir do produto/funil
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { project_id, funil_id, modelo = 'lancamento', data_carrinho_aberto, dias_pre_lancamento = 7 } = await req.json();
    if (!project_id || !data_carrinho_aberto) {
      return new Response(JSON.stringify({ error: 'project_id e data_carrinho_aberto obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: project } = await sb.from('imphq_projects').select('id, name, briefing').eq('id', project_id).maybeSingle();

    const start = new Date(data_carrinho_aberto);
    const pre = new Date(start.getTime() - dias_pre_lancamento * 86400000);

    const prompt = `Você é um diretor de lançamento. Gere um cronograma do projeto "${project?.name}" (modelo: ${modelo}).
Carrinho abre em ${start.toISOString().slice(0,10)}. Pré-lançamento começa em ${pre.toISOString().slice(0,10)}.
Inclua: pré-lançamento (conteúdo/aquecimento), aulas/lives, abertura, lembretes, escassez, fechamento.
Retorne JSON: { "items": [{ "peca_tipo": "criativo|live|email|wa|cpl|abertura|fechamento|lembrete", "title": "...", "description": "...", "scheduled_at": "ISO", "duration_min": 60, "is_milestone": bool }] }
Datas devem ser sequenciais e fazer sentido para o modelo.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: 'ai_failed', detail: txt }), {
        status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const items = (parsed.items || []).slice(0, 60);

    const rows = items.map((it: any) => ({
      projeto_id: project_id,
      funil_id: funil_id || null,
      peca_tipo: String(it.peca_tipo || 'evento'),
      title: String(it.title || 'Item'),
      description: it.description || null,
      scheduled_at: new Date(it.scheduled_at).toISOString(),
      duration_min: Number(it.duration_min || 60),
      is_milestone: Boolean(it.is_milestone),
      status: 'pending',
      meta: { modelo, generated_by: 'launch-timeline-generate' },
    }));

    if (rows.length) {
      const { error } = await sb.from('imphq_launch_timeline').insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Gera nova copy/VSL a partir de um site existente, adaptada ao avatar de um projeto destino
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { site_id, projeto_id, modo = 'lp' } = await req.json();
    if (!site_id || !projeto_id) {
      return new Response(JSON.stringify({ error: 'site_id e projeto_id obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const [{ data: site }, { data: projeto }] = await Promise.all([
      supabase.from('imphq_sites').select('*').eq('id', site_id).maybeSingle(),
      supabase.from('imphq_projects').select('id, nome, data').eq('id', projeto_id).maybeSingle(),
    ]);

    if (!site) return new Response(JSON.stringify({ error: 'Site não encontrado' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const avatar = projeto?.data?.avatar || projeto?.data?.avatars_por_produto || null;
    const branding = projeto?.data?.branding || null;

    const systemPrompt = `Você é o Imperius, copywriter estratégico. Reescreva a copy do site base adaptando-a ao novo projeto, mantendo a estrutura de persuasão (headline, sub-headline, dores, promessa, prova, oferta, CTA). Use português Brasil. Modo: ${modo}.`;

    const userPrompt = `## SITE BASE
URL: ${site.url}
Título: ${site.titulo}
Resumo: ${site.summary || ''}

### Copy original (markdown)
${(site.content_md || '').slice(0, 6000)}

## PROJETO DESTINO
Nome: ${projeto?.nome || projeto_id}

### Avatar
${JSON.stringify(avatar)?.slice(0, 3000) || 'sem avatar definido'}

### Branding
${JSON.stringify(branding)?.slice(0, 1500) || 'sem branding'}

## TAREFA
Gere uma nova copy adaptada (markdown), com seções claras (Headline, Sub, Bullets, Oferta, CTA). Mantenha o esqueleto original mas troque exemplos, dores e provas para se encaixar no avatar deste projeto destino.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI ${aiRes.status}: ${txt}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const copy = aiJson.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ success: true, copy, branding: site.branding_json }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[site-clone] error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

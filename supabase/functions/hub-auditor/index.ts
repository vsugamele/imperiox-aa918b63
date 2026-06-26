import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { project_id, product, existing_assets } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Coleta paralela
    const [{ data: project }, { data: vendas }, { data: leads }, { data: ads }] = await Promise.all([
      sb.from('imphq_projects').select('id, name, briefing').eq('id', project_id).maybeSingle(),
      sb.from('imphq_vendas').select('id, valor, produto, status, created_at')
        .eq('project_id', project_id).order('created_at', { ascending: false }).limit(200),
      sb.from('imphq_leads').select('id, status, created_at')
        .eq('project_id', project_id).order('created_at', { ascending: false }).limit(500),
      sb.from('imphq_ads_spend').select('spend, impressions, clicks, ctr, cpa, date')
        .eq('project_id', project_id).order('date', { ascending: false }).limit(60),
    ]);

    // KPIs rápidos
    const totalVendas = vendas?.length || 0;
    const ticketMedio = totalVendas ? (vendas!.reduce((s, v: any) => s + Number(v.valor || 0), 0) / totalVendas) : 0;
    const totalSpend = ads?.reduce((s, a: any) => s + Number(a.spend || 0), 0) || 0;
    const totalLeads = leads?.length || 0;
    const cpa = totalVendas ? totalSpend / totalVendas : 0;
    const avgCtr = ads?.length ? (ads.reduce((s, a: any) => s + Number(a.ctr || 0), 0) / ads.length) : 0;

    const briefing = (project?.briefing as any) || {};
    const existing = (existing_assets || []).map((a: any) => `${a.catId}:${a.itemId}=${a.status}`).join(', ');

    const systemPrompt = `Você é o Imperius Funnel Auditor. Analise o funil de um produto e retorne um diagnóstico estratégico em JSON.

Categorias de ativos disponíveis no Hub (catId:itemId):
- produto: order_bump, upsell, downsell
- ofertas: tripwire, core, premium, bonus
- publico: avatar_4, dores, desejos, objecoes
- estrategias: escada_valor, mapa_funil, reposicionamento
- ads: copy_anuncio, criativos, headlines, ganchos_impactantes, verdade_devastadora, tormento_real, ganchos_agressivos, arma_curiosidade
- copy: nomes_viciantes, promessas, mecanismos, metodologia, oferta_devastadora, proposta_unica
- scripts: reels, stories, lives, dm
- emails: boas_vindas, nutricao, pitch, recuperacao
- vsl: vsl_7blocos, hero, promessa, mecanismo_vsl, prova, cta

Use o framework Yoshitani 7/5/3 (7% CTR ads, 5% conv LP, 3% conv checkout) para detectar gargalos.`;

    const userPrompt = `PROJETO: ${project?.name}
PRODUTO ALVO: ${product?.nome || product?.name || '—'} (R$ ${product?.preco_por || product?.preco || '—'})
BRIEFING resumido: ${JSON.stringify(briefing).slice(0, 1500)}

KPIs:
- Vendas (últ 200): ${totalVendas} · Ticket médio: R$ ${ticketMedio.toFixed(2)}
- Leads (últ 500): ${totalLeads}
- Ads spend (60d): R$ ${totalSpend.toFixed(2)} · CPA: R$ ${cpa.toFixed(2)} · CTR médio: ${avgCtr.toFixed(2)}%

ATIVOS JÁ NO HUB: ${existing || 'nenhum'}

Retorne JSON com:
{
  "gargalo": { "etapa": "string (Tráfego|LP|Checkout|Pós-venda|Avatar)", "diagnostico": "1-2 frases", "metrica": "número/contexto" },
  "ativos_faltantes": [ { "catId": "x", "itemId": "y", "score": 0-100, "motivo": "1 frase prática" } ],
  "proxima_acao": "1 ação concreta e específica em 1-2 frases"
}

Priorize 5-7 ativos faltantes alinhados ao gargalo. Score alto = mais urgente.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: 'AI failed', detail: txt }), {
        status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return new Response(JSON.stringify({
      audit: parsed,
      kpis: { totalVendas, ticketMedio, totalLeads, totalSpend, cpa, avgCtr },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

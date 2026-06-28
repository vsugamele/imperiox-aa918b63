// Executa ações aprovadas do Auditor do Funil
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { action_id } = await req.json();
    if (!action_id) {
      return new Response(JSON.stringify({ error: 'action_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: action, error } = await sb
      .from('imphq_funnel_audit_actions')
      .select('*')
      .eq('id', action_id)
      .maybeSingle();
    if (error || !action) {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: corsHeaders });
    }
    if (action.status === 'executed') {
      return new Response(JSON.stringify({ ok: true, already: true }), { headers: corsHeaders });
    }

    let result: Record<string, unknown> = {};

    // Tipos suportados
    if (action.action_type === 'add_funnel_asset') {
      const payload = action.payload as any;
      const { catId, itemId, projectId, product_nome } = payload || {};
      // Lê funil atual do projeto e adiciona uma etapa
      const { data: funil } = await sb
        .from('imphq_funis')
        .select('id, data')
        .eq('project_id', projectId || action.projeto_id)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (funil) {
        const etapas = (funil.data as any)?.etapas || [];
        etapas.push({
          nome: `${catId}:${itemId}`,
          tipo: 'caixa',
          visitantes: 0,
          conversoes: 0,
          pos_x: 80 + (etapas.length % 6) * 320,
          pos_y: 80 + Math.floor(etapas.length / 6) * 200,
          descricao: `Sugerido pelo Auditor (${product_nome || ''})`,
        });
        await sb.from('imphq_funis').update({ data: { ...(funil.data as any), etapas } }).eq('id', funil.id);
        result = { added_to_funnel: funil.id, etapas_total: etapas.length };
      } else {
        result = { skipped: true, reason: 'sem funil' };
      }
    } else if (action.action_type === 'create_node_copy') {
      // Apenas marca; cópia real fica via funnel-node-copy
      result = { delegated: 'funnel-node-copy' };
    } else {
      result = { noop: true };
    }

    await sb
      .from('imphq_funnel_audit_actions')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        executed_result: result,
      })
      .eq('id', action_id);

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

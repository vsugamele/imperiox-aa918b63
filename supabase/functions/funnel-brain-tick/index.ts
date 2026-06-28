// Cérebro do Funil — gera sinais preditivos cruzando vendas, ads, leads e ativos
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

interface Signal {
  projeto_id: string;
  funil_id?: string | null;
  node_id?: string | null;
  produto_id?: string | null;
  signal_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  reasoning?: string;
  suggested_action: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const projetoFilter: string | undefined = body.project_id;

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    let projetos: { id: string; name: string; status?: string }[] = [];
    if (projetoFilter) {
      const { data } = await sb.from('imphq_projects').select('id, name, status').eq('id', projetoFilter);
      projetos = data || [];
    } else {
      const { data } = await sb.from('imphq_projects').select('id, name, status').eq('status', 'Vendendo').limit(20);
      projetos = data || [];
    }

    const signals: Signal[] = [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    for (const p of projetos) {
      // 1) Vendas últimas 7d vs 7d anteriores → queda de receita
      const { data: vendas } = await sb
        .from('imphq_vendas')
        .select('valor, created_at, produto, status')
        .eq('project_id', p.id)
        .gte('created_at', new Date(now - 14 * day).toISOString())
        .limit(2000);

      const v = vendas || [];
      const cur = v.filter((x: any) => new Date(x.created_at).getTime() > now - 7 * day);
      const prev = v.filter((x: any) => {
        const t = new Date(x.created_at).getTime();
        return t <= now - 7 * day && t > now - 14 * day;
      });
      const curRev = cur.reduce((s: number, x: any) => s + Number(x.valor || 0), 0);
      const prevRev = prev.reduce((s: number, x: any) => s + Number(x.valor || 0), 0);
      if (prevRev > 0 && curRev < prevRev * 0.7) {
        signals.push({
          projeto_id: p.id,
          signal_type: 'revenue_drop',
          severity: curRev < prevRev * 0.5 ? 'critical' : 'high',
          title: `Receita caiu ${Math.round((1 - curRev / prevRev) * 100)}% em 7d`,
          reasoning: `Últimos 7d: R$ ${curRev.toFixed(0)} vs anteriores R$ ${prevRev.toFixed(0)}.`,
          suggested_action: { kind: 'run_audit', cta: 'Rodar auditoria do funil' },
          evidence: { curRev, prevRev, currentCount: cur.length, prevCount: prev.length },
        });
      }

      // 2) Ads spend sem venda → desperdício
      const { data: ads } = await sb
        .from('imphq_ads_spend')
        .select('spend, date')
        .eq('project_id', p.id)
        .gte('date', new Date(now - 7 * day).toISOString().slice(0, 10))
        .limit(500);
      const spend7 = (ads || []).reduce((s: number, a: any) => s + Number(a.spend || 0), 0);
      if (spend7 > 200 && cur.length === 0) {
        signals.push({
          projeto_id: p.id,
          signal_type: 'ads_no_conversion',
          severity: 'critical',
          title: `R$ ${spend7.toFixed(0)} em ads sem vendas (7d)`,
          reasoning: 'Spend acumulado sem nenhuma conversão registrada.',
          suggested_action: { kind: 'pause_review', cta: 'Revisar criativos e LP' },
          evidence: { spend7, vendas7: 0 },
        });
      }

      // 3) Leads sem follow-up há 48h
      const { count: leadsParados } = await sb
        .from('imphq_leads')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', p.id)
        .lt('updated_at', new Date(now - 2 * day).toISOString())
        .in('status', ['novo', 'qualificado', 'morno']);
      if ((leadsParados || 0) > 5) {
        signals.push({
          projeto_id: p.id,
          signal_type: 'leads_cooling',
          severity: 'medium',
          title: `${leadsParados} leads esfriando (>48h)`,
          reasoning: 'Esses leads receberam o último contato há mais de 48h.',
          suggested_action: { kind: 'reactivate', cta: 'Disparar reativação' },
          evidence: { count: leadsParados },
        });
      }
    }

    // Persiste (upsert por unique title+projeto ativos)
    if (signals.length) {
      for (const s of signals) {
        // Evita duplicar se já tem sinal ativo do mesmo tipo no projeto
        const { data: existing } = await sb
          .from('imphq_funnel_brain_signals')
          .select('id')
          .eq('projeto_id', s.projeto_id)
          .eq('signal_type', s.signal_type)
          .eq('status', 'active')
          .maybeSingle();
        if (existing) {
          await sb.from('imphq_funnel_brain_signals').update({
            title: s.title,
            reasoning: s.reasoning,
            evidence: s.evidence,
            severity: s.severity,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
        } else {
          await sb.from('imphq_funnel_brain_signals').insert(s);
        }
      }
    }

    // Expira sinais antigos
    await sb
      .from('imphq_funnel_brain_signals')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active');

    return new Response(JSON.stringify({ ok: true, generated: signals.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('brain-tick error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

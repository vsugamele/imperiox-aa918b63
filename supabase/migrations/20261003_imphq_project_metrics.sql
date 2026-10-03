-- Valores reais das métricas do catálogo (_shared/metric-keys.ts) para um projeto, desde uma data (Story MAP2.3).
-- Usado pela visão "Caminho" para comparar real × meta. Só chaves com fonte que já recebe dado; sem dado = null (nunca 0 inventado).
-- Métricas de etapa (sessões, cliques para o checkout) saem no nível do projeto nesta versão.
create or replace function public.imphq_project_metrics(p_project_id text, p_since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with
  v as (
    select count(*) filter (where status = 'aprovado') vendas,
           coalesce(sum(valor) filter (where status = 'aprovado'), 0) receita,
           count(*) filter (where status = 'aprovado' and coalesce(utm_source, '') <> '') com_origem
    from imphq_vendas where project_id = p_project_id and created_at >= p_since
  ),
  g as (
    select sum(valor) gasto, count(*) linhas
    from imphq_ads_spend where project_id = p_project_id and coalesce(data_ref, data) >= p_since::date
  ),
  l as (select count(*) leads from imphq_leads where project_id = p_project_id and created_at >= p_since),
  c as (
    select count(*) conversas from imphq_wa_conversations
    where project_id = p_project_id and created_at >= p_since and coalesce(jid_suffix, '') <> 'g.us'
  ),
  ia as (
    select count(*) respostas from imphq_wa_messages
    where project_id = p_project_id and created_at >= p_since and sent_by = 'ai'
  ),
  e as (
    select count(distinct session_id) filter (where event_name = 'PageView') sessoes,
           count(*) filter (where event_name = 'InitiateCheckout') ics,
           count(distinct session_id) filter (where utm_medium = 'bio') bio
    from imphq_events where project_id = p_project_id and created_at >= p_since
  ),
  cp as (
    select count(*) filter (where status = 'publicado') publicados from imphq_content_posts
    where project_id = p_project_id and coalesce(published_at, created_at) >= p_since
  ),
  cm as (
    select sum(m.views) views, sum(m.comments) comentarios, count(*) linhas
    from imphq_content_metrics_daily m join imphq_social_accounts a on a.id = m.account_id
    where a.project_id = p_project_id and m.metric_date >= p_since::date
  ),
  sg as (
    select sum(f) seguidores from (
      select distinct on (m.account_id) m.followers f
      from imphq_content_metrics_daily m join imphq_social_accounts a on a.id = m.account_id
      where a.project_id = p_project_id and m.followers is not null
      order by m.account_id, m.metric_date desc
    ) x
  )
  select jsonb_build_object(
    'vendas', v.vendas,
    'receita', round(v.receita, 2),
    'vendas_com_origem', case when v.vendas > 0 then round(100.0 * v.com_origem / v.vendas, 1) end,
    'gasto_ads', case when g.linhas > 0 then round(g.gasto, 2) end,
    'cpa', case when g.linhas > 0 and v.vendas > 0 then round(g.gasto / v.vendas, 2) end,
    'roas', case when g.linhas > 0 and g.gasto > 0 then round(v.receita / g.gasto, 2) end,
    'cpl', case when g.linhas > 0 and l.leads > 0 then round(g.gasto / l.leads, 2) end,
    'custo_por_ic', case when g.linhas > 0 and e.ics > 0 then round(g.gasto / e.ics, 2) end,
    'leads', l.leads,
    'inscritos', l.leads,
    'conversas_x1', c.conversas,
    'respostas_ia', ia.respostas,
    'sessoes_pagina', e.sessoes,
    'cliques_checkout', e.ics,
    'taxa_clique_checkout', case when e.sessoes > 0 then round(100.0 * e.ics / e.sessoes, 1) end,
    'cliques_bio', e.bio,
    'posts_publicados', cp.publicados,
    'views_conteudo', case when cm.linhas > 0 then cm.views end,
    'comentarios', case when cm.linhas > 0 then cm.comentarios end,
    'seguidores', sg.seguidores
  )
  from v, g, l, c, ia, e, cp, cm, sg;
$$;

grant execute on function public.imphq_project_metrics(text, timestamptz) to authenticated, service_role;

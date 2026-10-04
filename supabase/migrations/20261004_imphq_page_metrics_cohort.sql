-- MAP2.4: taxas da mesma coorte e consumo desconhecido quando falta sessão.
create or replace function public.imphq_page_metrics(p_project_id text, p_since timestamptz)
returns jsonb language sql stable security invoker set search_path = public as $$
  with events as (
    select public.imphq_metric_page_url(page_url) url, nullif(session_id, '') session_id,
           created_at, 'funnel'::text source,
           step in ('vsl_view', 'advertorial_view', 'pdp_view', 'quiz') is_view,
           step in ('vsl_cta_click', 'advertorial_cta_click', 'pdp_cta_click') is_cta,
           false is_ic, utm_medium
    from public.imphq_funnel_events
    where project_id = p_project_id and created_at <= now()
      and step in ('vsl_view', 'advertorial_view', 'pdp_view', 'quiz',
                   'vsl_cta_click', 'advertorial_cta_click', 'pdp_cta_click')
      and lower(coalesce(utm_source, '')) <> 'codex-validation'
      and lower(coalesce(meta->>'validation', 'false')) <> 'true'
      and lower(coalesce(meta->>'qa_source', '')) <> 'codex-validation'
    union all
    select public.imphq_metric_page_url(page_url), nullif(session_id, ''), created_at,
           'legacy'::text, event_name = 'PageView',
           event_name = 'InitiateCheckout' and nullif(event_data->>'cta_id', '') is not null,
           event_name = 'InitiateCheckout', utm_medium
    from public.imphq_events
    where project_id = p_project_id and created_at <= now()
      and event_name in ('PageView', 'InitiateCheckout')
      and lower(coalesce(utm_source, '')) <> 'codex-validation'
      and lower(coalesce(metadata->>'validation', event_data->>'validation', 'false')) <> 'true'
  ), sessions as (
    select url, session_id,
      bool_or(is_view and created_at >= p_since) viewed,
      bool_or(is_cta and created_at >= p_since) clicked,
      bool_or(is_ic and created_at >= p_since) checkout,
      bool_or(is_view and utm_medium = 'bio' and created_at >= p_since) bio
    from events where url is not null and session_id is not null group by url, session_id
  ), counts as (
    select url, count(*) filter(where viewed) sessions,
      count(*) filter(where clicked) ctas, count(*) filter(where checkout) ics,
      count(*) filter(where viewed and clicked) ctas_with_view,
      count(*) filter(where viewed and checkout) ics_with_view,
      count(*) filter(where bio) bio
    from sessions group by url
  ), pages as (
    select e.url, array_agg(distinct e.source order by e.source) sources, max(e.created_at) last_event_at,
      coalesce(c.sessions, 0) sessions, coalesce(c.ctas, 0) ctas, coalesce(c.ics, 0) ics,
      coalesce(c.ctas_with_view, 0) ctas_with_view, coalesce(c.ics_with_view, 0) ics_with_view,
      coalesce(c.bio, 0) bio,
      bool_or(e.is_view and e.session_id is null and e.created_at >= p_since) unknown_views,
      bool_or(e.is_cta and e.session_id is null and e.created_at >= p_since) unknown_ctas,
      bool_or(e.is_ic and e.session_id is null and e.created_at >= p_since) unknown_ics,
      bool_or(e.is_view and e.utm_medium = 'bio' and e.session_id is null and e.created_at >= p_since) unknown_bio
    from events e left join counts c using(url)
    where e.url is not null group by e.url, c.sessions, c.ctas, c.ics, c.ctas_with_view, c.ics_with_view, c.bio
  )
  select jsonb_build_object(
    'project_id', p_project_id, 'since', p_since, 'measured_at', now(),
    'pages', coalesce(jsonb_agg(jsonb_build_object(
      'url', url, 'sources', sources, 'last_event_at', last_event_at,
      'missing_session_ids', unknown_views or unknown_ctas or unknown_ics,
      'values', jsonb_build_object(
        'sessoes_pagina', case when not unknown_views then sessions end,
        'cliques_cta', case when not unknown_ctas then ctas end,
        'taxa_clique_cta', case when sessions > 0 and not unknown_views and not unknown_ctas then round(100.0 * ctas_with_view / sessions, 1) end,
        'cliques_checkout', case when not unknown_ics then ics end,
        'taxa_clique_checkout', case when sessions > 0 and not unknown_views and not unknown_ics then round(100.0 * ics_with_view / sessions, 1) end,
        'cliques_bio', case when not unknown_bio then bio end
      )
    ) order by url), '[]'::jsonb)
  ) from pages;
$$;
revoke all on function public.imphq_page_metrics(text, timestamptz) from public, anon;
grant execute on function public.imphq_page_metrics(text, timestamptz) to authenticated, service_role;

-- Reversão: a versão anterior da UI não chama esta RPC; manter a função é compatível.
-- Não altera nem remove eventos, metas, parâmetros de escala ou registros manuais.

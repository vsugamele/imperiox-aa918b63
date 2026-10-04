-- MAP2.4: fonte agregada por projeto e URL. RLS do chamador continua valendo.
create or replace function public.imphq_metric_page_url(p_url text)
returns text language sql immutable strict set search_path = public as $$
  select nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    split_part(split_part(lower(btrim(p_url)), '?', 1), '#', 1),
    '^[a-z]+://(www\.)?', ''), '/+$', ''), '\.html$', ''), '/index$', ''), '');
$$;
revoke all on function public.imphq_metric_page_url(text) from public, anon;
grant execute on function public.imphq_metric_page_url(text) to authenticated, service_role;

create index if not exists idx_imphq_events_project_created
  on public.imphq_events(project_id, created_at desc);

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
  ), pages as (
    select url, array_agg(distinct source order by source) sources, max(created_at) last_event_at,
      count(distinct session_id) filter(where is_view and created_at >= p_since) sessions,
      count(distinct session_id) filter(where is_cta and created_at >= p_since) ctas,
      count(distinct session_id) filter(where is_ic and created_at >= p_since) ics,
      count(distinct session_id) filter(where is_view and utm_medium = 'bio' and created_at >= p_since) bio
    from events where url is not null group by url
  )
  select jsonb_build_object(
    'project_id', p_project_id, 'since', p_since, 'measured_at', now(),
    'pages', coalesce(jsonb_agg(jsonb_build_object(
      'url', url, 'sources', sources, 'last_event_at', last_event_at,
      'values', jsonb_build_object(
        'sessoes_pagina', sessions, 'cliques_cta', ctas,
        'taxa_clique_cta', case when sessions > 0 then round(100.0 * ctas / sessions, 1) end,
        'cliques_checkout', ics,
        'taxa_clique_checkout', case when sessions > 0 then round(100.0 * ics / sessions, 1) end,
        'cliques_bio', bio
      )
    ) order by url), '[]'::jsonb)
  ) from pages;
$$;
revoke all on function public.imphq_page_metrics(text, timestamptz) from public, anon;
grant execute on function public.imphq_page_metrics(text, timestamptz) to authenticated, service_role;

-- Reversão: a versão anterior da UI não chama esta RPC; manter a função é compatível.
-- Não altera nem remove eventos, metas, parâmetros de escala ou registros manuais.

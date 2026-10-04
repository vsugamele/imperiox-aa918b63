-- MAP2.4: regressão da RPC real, com fixtures isoladas em transação revertida.
-- Não enviar tráfego, mensagens ou chamadas de IA. O único trigger existente apenas preenche project_id.
begin;
insert into public.imphq_funnel_events(project_id,session_id,step,page_url,utm_source,meta,created_at) values
('__map24_fixture_a__','s1','vsl_view','https://map24-regression.invalid/page',null,'{}',now()),
('__map24_fixture_a__','s1','vsl_view','https://map24-regression.invalid/page?utm=x',null,'{}',now()),
('__map24_fixture_a__','s2','vsl_view','https://map24-regression.invalid/page',null,'{}',now()),
('__map24_fixture_a__','s1','vsl_cta_click','https://map24-regression.invalid/page',null,'{}',now()),
('__map24_fixture_a__','s1','vsl_cta_click','https://map24-regression.invalid/page',null,'{}',now()),
('__map24_fixture_a__','orphan','vsl_cta_click','https://map24-regression.invalid/page',null,'{}',now()),
('__map24_fixture_a__','qa1','vsl_view','https://map24-regression.invalid/validation',null,'{"validation":true}',now()),
('__map24_fixture_a__','qa2','vsl_view','https://map24-regression.invalid/validation','codex-validation','{}',now()),
('__map24_fixture_b__','s1','vsl_view','https://map24-regression.invalid/page',null,'{}',now());
insert into public.imphq_events(project_id,session_id,event_name,page_url,event_data,created_at) values
('__map24_fixture_a__','s1','PageView','http://www.map24-regression.invalid/page.html?utm=x','{}',now()),
('__map24_fixture_a__','s1','InitiateCheckout','https://map24-regression.invalid/page','{"cta_id":"buy"}',now()),
('__map24_fixture_a__','s1','InitiateCheckout','https://map24-regression.invalid/page','{"cta_id":"buy"}',now()),
('__map24_fixture_a__','old','PageView','https://map24-regression.invalid/zero','{}',now()-interval '8 days'),
('__map24_fixture_a__',null,'PageView','https://map24-regression.invalid/unknown','{}',now());
do $$
declare result jsonb; page jsonb; zero_page jsonb; unknown_page jsonb; other_page jsonb;
begin
  result := public.imphq_page_metrics('__map24_fixture_a__',now()-interval '7 days');
  select p into page from jsonb_array_elements(result->'pages') p where p->>'url'='map24-regression.invalid/page';
  if page->'values'->>'sessoes_pagina' is distinct from '2' then raise exception 'Duplicate view across trackers or URLs'; end if;
  if page->'values'->>'cliques_cta' is distinct from '2' then raise exception 'Repeated CTA counted twice'; end if;
  if (page->'values'->>'taxa_clique_cta')::numeric is distinct from 50 then raise exception 'CTA rate mixed different cohorts'; end if;
  if page->'values'->>'cliques_checkout' is distinct from '1' then raise exception 'CTA was promoted to checkout or IC duplicated'; end if;
  if jsonb_array_length(page->'sources') is distinct from 2 then raise exception 'Tracker source missing'; end if;
  if exists(select 1 from jsonb_array_elements(result->'pages') p where p->>'url' like '%/validation') then raise exception 'Validation entered operation'; end if;
  select p into zero_page from jsonb_array_elements(result->'pages') p where p->>'url' like '%/zero';
  select p into unknown_page from jsonb_array_elements(result->'pages') p where p->>'url' like '%/unknown';
  if zero_page->'values'->>'sessoes_pagina' is distinct from '0' or unknown_page->'values'->>'sessoes_pagina' is not null
    or unknown_page->>'missing_session_ids' is distinct from 'true' then raise exception 'Unknown data became zero'; end if;
  select p into other_page from jsonb_array_elements(public.imphq_page_metrics('__map24_fixture_b__',now()-interval '7 days')->'pages') p
    where p->>'url'='map24-regression.invalid/page';
  if other_page->'values'->>'sessoes_pagina' is distinct from '1' then raise exception 'Projects shared a counter'; end if;
end $$;
select '8 verificações da RPC passaram; fixtures serão revertidas' as resultado;
rollback;

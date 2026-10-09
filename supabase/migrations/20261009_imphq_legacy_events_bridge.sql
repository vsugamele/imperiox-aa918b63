-- TRK1.4: ponte do tracker antigo (inline em páginas fora do repo, grava em imphq_events) para imphq_funnel_events.
-- A página dos anúncios do CCP (codigodoscortesperfeitos.vercel.app) só tem o tracker antigo: 787 visitas em 7 dias
-- ficavam fora da tela do Tracker e do painel, que leem imphq_funnel_events.
-- Só entra tráfego rastreado (UTM ou fbclid), para robôs e visitas soltas não inflarem as etapas do funil.

-- O preenchimento do projeto pelo domínio rodava como anon (a página grava com a chave pública) e o RLS de
-- imphq_project_domains escondia o cadastro: 780 eventos da página do CCP ficaram sem projeto desde 03/10.
alter function public.imphq_events_fill_project() security definer set search_path = public;

update public.imphq_events e
   set project_id = r.project_id,
       metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object('project_from_domain', true, 'backfill', 'TRK1.4')
  from (select id, public.imphq_resolve_project(page_url) project_id from public.imphq_events
         where project_id is null and page_url ~* '^https?://' and created_at >= now() - interval '30 days') r
 where e.id = r.id and r.project_id is not null;

create or replace function public.imphq_bridge_legacy_event(e public.imphq_events)
returns void language plpgsql security definer set search_path = public as $$
declare
  step text;
  qs text;
  fbclid text;
  utm_id text;
begin
  if e.project_id is null or e.page_url is null or e.page_url !~* '^https?://' then return; end if;
  step := case e.event_name
    when 'PageView' then 'vsl_view'
    when 'ViewContent' then 'vsl_play'
    when 'AddToCart' then 'vsl_cta_click'
    when 'InitiateCheckout' then 'checkout'
    when 'LeadCapture' then 'quiz'
    when 'Lead' then 'quiz'
    else null end;
  if step is null then return; end if;
  qs := split_part(split_part(e.page_url, '#', 1), '?', 2);
  fbclid := nullif(substring('&' || qs from '&fbclid=([^&]+)'), '');
  utm_id := nullif(substring('&' || qs from '&utm_id=([^&]+)'), '');
  if e.utm_source is null and e.utm_campaign is null and fbclid is null then return; end if;
  insert into public.imphq_funnel_events(project_id, session_id, step, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    utm_id, fbclid, referrer, user_agent, page_url, meta, created_at, event_id, visitor_id, event_at)
  values (e.project_id, e.session_id, step, e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.utm_term,
    utm_id, fbclid, e.referrer, e.user_agent, e.page_url,
    jsonb_build_object('source', 'legacy_events', 'tracker_version', 'legacy', 'legacy_event', e.event_name,
      'validation', lower(coalesce(e.utm_source, '')) = 'codex-validation'),
    e.created_at, 'legacy_' || e.id, e.visitor_id, e.created_at)
  on conflict (project_id, event_id) do nothing;
end $$;

create or replace function public.imphq_events_bridge_legacy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.imphq_bridge_legacy_event(new);
  exception when others then
    -- A ponte nunca derruba a gravação original do evento.
    raise warning 'imphq_bridge_legacy_event: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists imphq_events_bridge_legacy on public.imphq_events;
create trigger imphq_events_bridge_legacy after insert on public.imphq_events
  for each row execute function public.imphq_events_bridge_legacy();

revoke all on function public.imphq_bridge_legacy_event(public.imphq_events) from public, anon, authenticated;
revoke all on function public.imphq_events_bridge_legacy() from public, anon, authenticated;

-- Histórico de 30 dias (idempotente pelo event_id "legacy_<id>").
select public.imphq_bridge_legacy_event(e) from public.imphq_events e where e.created_at >= now() - interval '30 days';

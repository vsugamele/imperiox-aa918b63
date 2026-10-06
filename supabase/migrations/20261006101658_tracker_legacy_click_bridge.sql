-- Keep registered-link metrics working when old inline installs are replaced by TRK1.1.
do $$
declare d text; original text:='return jsonb_build_object(''ok'',true,''duplicate'',inserted is null,''event_id'',ev.event_id);';
begin
 select pg_get_functiondef('public.imphq_ingest_funnel_event(jsonb,text)'::regprocedure) into d;
 if position('TRK1.1 legacy click bridge' in d)=0 then
  if position(original in d)=0 then raise exception 'ingestion_return_not_found'; end if;
  d:=replace(d,original,$bridge$
  -- TRK1.1 legacy click bridge. Only actual page entries; QA never inflates old metrics.
  if inserted is not null and ev.click_id is not null and ev.step in ('vsl_view','advertorial_view','pdp_view')
    and lower(coalesce(ev.meta->>'validation','false'))<>'true' and lower(coalesce(ev.utm_source,''))<>'codex-validation'
    and (nullif(ev.meta->>'link_id','') is not null or ev.utm_source is not null or ev.utm_campaign is not null)
    and (nullif(ev.meta->>'link_id','') is null or exists(select 1 from public.imphq_tracking_links l where l.id=ev.meta->>'link_id' and l.project_id=ev.project_id and coalesce(l.ativo,true))) then
    insert into public.imphq_clicks(id,project_id,link_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,ua,referer)
    values(ev.click_id,ev.project_id,nullif(ev.meta->>'link_id',''),ev.utm_source,ev.utm_medium,ev.utm_campaign,ev.utm_content,ev.utm_term,ev.user_agent,ev.referrer)
    on conflict(id) do nothing;
  end if;
  return jsonb_build_object('ok',true,'duplicate',inserted is null,'event_id',ev.event_id);
  $bridge$);
  execute d;
 end if;
end $$;

-- Unassigned global links remain valid; links assigned to another project remain excluded.
do $$ declare d text; begin
 select pg_get_functiondef('public.imphq_ingest_funnel_event(jsonb,text)'::regprocedure) into d;
 if position('TRK1.1 legacy click bridge' in d)=0 then raise exception 'legacy_bridge_missing'; end if;
 d:=replace(d,'l.project_id=ev.project_id and coalesce(l.ativo,true)','(l.project_id=ev.project_id or l.project_id is null) and coalesce(l.ativo,true)');
 d:=replace(d,'ev.utm_source is not null or ev.utm_campaign is not null','ev.utm_source is not null or ev.utm_campaign is not null or ev.utm_medium is not null or ev.utm_content is not null or ev.utm_term is not null');
 if position('l.project_id is null' in d)=0 then raise exception 'global_link_patch_missing'; end if;
 execute d;
end $$;

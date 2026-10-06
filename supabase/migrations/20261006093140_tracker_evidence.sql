-- TRK1.1: additive identity, idempotent ingestion, evidence and server aggregates.
alter table public.imphq_funnel_events alter column session_id drop not null;
alter table public.imphq_funnel_events add column if not exists event_id text,
  add column if not exists visitor_id text, add column if not exists click_id text,
  add column if not exists event_at timestamptz, add column if not exists campaign_id text,
  add column if not exists adset_id text, add column if not exists ad_id text,
  add column if not exists first_touch jsonb, add column if not exists last_touch jsonb;
create unique index if not exists idx_funnel_event_identity on public.imphq_funnel_events(project_id,event_id);
create index if not exists idx_funnel_click_project on public.imphq_funnel_events(project_id,click_id,event_at desc) where click_id is not null;
create index if not exists idx_funnel_session_received on public.imphq_funnel_events(project_id,session_id,created_at desc);
create index if not exists idx_vendas_project_sale_time on public.imphq_vendas(project_id,data_venda);

create or replace function public.imphq_ingest_funnel_event(p_event jsonb,p_origin text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ev public.imphq_funnel_events; allowed jsonb; inserted uuid;
begin
  ev := jsonb_populate_record(null::public.imphq_funnel_events,p_event);
  if not exists(select 1 from public.imphq_projects where id=ev.project_id) then return jsonb_build_object('ok',false,'error','unknown_project'); end if;
  select settings->'tracker'->'allowed_origins' into allowed from public.imphq_projects where id=ev.project_id;
  if jsonb_typeof(allowed)='array' and jsonb_array_length(allowed)>0 and (p_origin is null or not allowed ? p_origin) then return jsonb_build_object('ok',false,'error','origin_not_allowed'); end if;
  if ev.meta->>'tracker_version'='TRK1.1' then
    if ev.event_id is null or ev.session_id is null then return jsonb_build_object('ok',false,'error','missing_identity'); end if;
  end if;
  if ev.event_id is not null and exists(select 1 from public.imphq_funnel_events where project_id=ev.project_id and event_id=ev.event_id) then return jsonb_build_object('ok',true,'duplicate',true,'event_id',ev.event_id); end if;
  -- Bound each session. This is abuse containment, not authentication of public browser traffic.
  perform pg_advisory_xact_lock(hashtextextended(ev.project_id||coalesce(ev.session_id,'unknown'),0));
  if (select count(*) from public.imphq_funnel_events where project_id=ev.project_id and session_id is not distinct from ev.session_id and created_at>now()-interval '1 minute')>=180 then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
  insert into public.imphq_funnel_events(project_id,session_id,visitor_id,click_id,event_id,event_at,step,lead_id,
    utm_source,utm_medium,utm_campaign,utm_content,utm_term,utm_id,xcod,creative_id,fbclid,referrer,user_agent,page_url,meta,campaign_id,adset_id,ad_id,first_touch,last_touch)
  values(ev.project_id,ev.session_id,ev.visitor_id,ev.click_id,ev.event_id,coalesce(ev.event_at,now()),ev.step,ev.lead_id,
    ev.utm_source,ev.utm_medium,ev.utm_campaign,ev.utm_content,ev.utm_term,ev.utm_id,ev.xcod,ev.creative_id,ev.fbclid,ev.referrer,ev.user_agent,ev.page_url,ev.meta,ev.campaign_id,ev.adset_id,ev.ad_id,ev.first_touch,ev.last_touch)
  on conflict(project_id,event_id) do nothing returning id into inserted;
  return jsonb_build_object('ok',true,'duplicate',inserted is null,'event_id',ev.event_id);
end $$;
revoke all on function public.imphq_ingest_funnel_event(jsonb,text) from public,anon,authenticated;
grant execute on function public.imphq_ingest_funnel_event(jsonb,text) to service_role;

-- Existing trigger remains unchanged for all non-H&W providers.
do $$ declare definition text; begin
 select pg_get_functiondef('public.imphq_vendas_calc_valor_liquido()'::regprocedure) into definition;
 if position('TRK1.1' in definition)=0 then
  definition:=replace(definition,'BEGIN',E'BEGIN\n  -- TRK1.1: explicit H&W commission may be zero or unknown.\n  IF NEW.plataforma = ''H&W'' AND NEW.data ? ''comissao_produtor'' THEN\n    NEW.valor_liquido := CASE WHEN jsonb_typeof(NEW.data->''comissao_produtor'') = ''number'' THEN (NEW.data->>''comissao_produtor'')::numeric ELSE NULL END;\n    RETURN NEW;\n  END IF;');
  if position('TRK1.1' in definition)=0 then raise exception 'commission_trigger_patch_not_applied'; end if;
  execute definition;
 end if;
end $$;

-- Atomic order-item write. No public caller can write sales through this function.
create or replace function public.imphq_upsert_hw_sale(p_row jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.imphq_vendas; oldrow public.imphq_vendas; sale_id text; skip_status boolean;
begin
 r:=jsonb_populate_record(null::public.imphq_vendas,p_row);
 if r.external_transaction_id is null or r.project_id is null then raise exception 'missing_order_identity'; end if;
 perform pg_advisory_xact_lock(hashtextextended('H&W:'||r.external_transaction_id,0));
 if (select count(*) from public.imphq_vendas where plataforma='H&W' and external_transaction_id=r.external_transaction_id)>1 then raise exception 'ambiguous_order_item'; end if;
 select * into oldrow from public.imphq_vendas where plataforma='H&W' and external_transaction_id=r.external_transaction_id for update;
 if found then
  if oldrow.project_id is distinct from r.project_id then raise exception 'order_project_conflict'; end if;
  skip_status:= (oldrow.status in ('aprovado','reembolsado','chargeback','cancelado') and r.status in ('pendente','recusado'))
    or (oldrow.status in ('reembolsado','chargeback','cancelado') and r.status='aprovado')
    or (nullif(r.data->>'provider_event_at','')::timestamptz < nullif(oldrow.data->>'provider_event_at','')::timestamptz);
  if coalesce(skip_status,false) then return jsonb_build_object('id',oldrow.id,'ignored_stale',true); end if;
  update public.imphq_vendas set status=r.status,valor=coalesce(r.valor,oldrow.valor),valor_liquido=coalesce(r.valor_liquido,oldrow.valor_liquido),
    produto_nome=coalesce(r.produto_nome,oldrow.produto_nome),produto_id_ext=coalesce(r.produto_id_ext,oldrow.produto_id_ext),
    data_venda=case when oldrow.status not in ('aprovado','reembolsado','chargeback') and r.status='aprovado' then coalesce(r.data_venda,oldrow.data_venda) else coalesce(oldrow.data_venda,r.data_venda) end,tipo_venda=coalesce(r.tipo_venda,oldrow.tipo_venda),nome=coalesce(r.nome,oldrow.nome),
    click_id=coalesce(r.click_id,oldrow.click_id),utm_source=coalesce(r.utm_source,oldrow.utm_source),utm_medium=coalesce(r.utm_medium,oldrow.utm_medium),
    utm_campaign=coalesce(r.utm_campaign,oldrow.utm_campaign),utm_content=coalesce(r.utm_content,oldrow.utm_content),utm_term=coalesce(r.utm_term,oldrow.utm_term),
    data=coalesce(oldrow.data,'{}'::jsonb) || coalesce(r.data,'{}'::jsonb)
  where id=oldrow.id returning id into sale_id;
 else
  sale_id:=gen_random_uuid()::text;
  insert into public.imphq_vendas(id,project_id,produto_nome,produto_id_ext,valor,valor_liquido,plataforma,status,data_venda,tipo_venda,external_transaction_id,nome,click_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,data)
  values(sale_id,r.project_id,r.produto_nome,r.produto_id_ext,r.valor,r.valor_liquido,'H&W',r.status,coalesce(r.data_venda,now()),r.tipo_venda,r.external_transaction_id,r.nome,r.click_id,r.utm_source,r.utm_medium,r.utm_campaign,r.utm_content,r.utm_term,r.data);
 end if;
 return jsonb_build_object('id',sale_id,'ignored_stale',false);
end $$;
revoke all on function public.imphq_upsert_hw_sale(jsonb) from public,anon,authenticated;
grant execute on function public.imphq_upsert_hw_sale(jsonb) to service_role;

create or replace view public.imphq_tracker_sales with (security_invoker=true) as
select v.id,v.lead_id,v.project_id,v.funil_id,v.produto_nome,v.produto_id_ext,v.valor,v.plataforma,v.status,v.data_venda,v.data,v.created_at,v.click_id,v.utm_source,v.utm_medium,v.utm_campaign,v.utm_content,v.utm_term,v.tipo_venda,v.external_transaction_id,case when v.plataforma='H&W' and v.data ? 'comissao_produtor' then case when jsonb_typeof(v.data->'comissao_produtor')='number' then (v.data->>'comissao_produtor')::numeric end else v.valor_liquido end valor_liquido,v.pais,v.learned_at,v.meta_offline_synced_at,v.nome,upper(coalesce(nullif(v.data->>'moeda',''),nullif(v.data->>'currency',''),'UNKNOWN')) currency,
  coalesce(nullif(v.data->'tracker'->>'ad_id',''),nullif(v.data->'atribuicao'->>'ad_id',''),e.ad_id,e.creative_id) attributed_ad_id,
  case when e.id is not null or (wa.metadata->>'match_method'='click_id' and wa.click_id=v.click_id and wa.sent_at between coalesce(v.data_venda,v.created_at)-interval '30 days' and coalesce(v.data_venda,v.created_at)+interval '5 minutes') then 'confirmed'
    when wa.id is not null or nullif(v.utm_source,'') is not null then 'inferred' else 'unknown' end attribution_confidence,
  case when e.id is not null then 'click_id' else coalesce(v.data->'tracker'->>'method',wa.metadata->>'match_method',case when wa.id is not null then 'legacy_whatsapp' when nullif(v.utm_source,'') is not null then 'provider_utm' else 'none' end) end attribution_method,
  case when wa.id is not null then 'whatsapp' when lower(coalesce(v.utm_medium,e.utm_medium,'')) in ('bio','organic','seo') or lower(coalesce(v.utm_source,e.utm_source,'')) in ('organic','organico','seo') then 'organic' when coalesce(nullif(v.data->'tracker'->>'ad_id',''),e.ad_id) is not null or lower(coalesce(v.utm_medium,e.utm_medium,'')) in ('cpc','paid','paid_social') or lower(coalesce(v.utm_source,e.utm_source,'')) in ('fb','facebook','meta','google','tiktok') then 'ads' else 'unknown' end attributed_channel, wa.source wa_source,wa.template_name wa_template
from public.imphq_vendas v
left join lateral(select * from public.imphq_wa_attribution a where a.venda_id=v.id and a.project_id=v.project_id order by a.matched_at desc nulls last limit 1)wa on true
left join lateral(select f.id,f.ad_id,f.creative_id,f.utm_source,f.utm_medium from public.imphq_funnel_events f where f.project_id=v.project_id and f.click_id=v.click_id and f.click_id is not null and f.event_at<=coalesce(v.data_venda,v.created_at)+interval '5 minutes' and f.event_at>=coalesce(v.data_venda,v.created_at)-interval '30 days' and lower(coalesce(f.meta->>'validation','false'))<>'true' and lower(coalesce(f.utm_source,''))<>'codex-validation' and f.step<>'heartbeat' order by f.event_at desc limit 1)e on true;
grant select on public.imphq_tracker_sales to authenticated,service_role;

create or replace function public.imphq_tracker_report(p_project_id text,p_since timestamptz,p_until timestamptz default now())
returns jsonb language sql stable security invoker set search_path=public as $$
with e as (
 select * from imphq_funnel_events where (p_project_id is null or project_id=p_project_id) and created_at>=p_since and created_at<p_until
 and lower(coalesce(meta->>'validation','false'))<>'true' and lower(coalesce(utm_source,''))<>'codex-validation'
), s as (
 select * from imphq_tracker_sales where (p_project_id is null or project_id=p_project_id) and data_venda>=p_since and data_venda<p_until
 and lower(coalesce(data->>'validation','false'))<>'true' and lower(coalesce(utm_source,''))<>'codex-validation'
), sales as (
 select project_id,currency,coalesce(attributed_ad_id,'unattributed') ad_id,
 sum(coalesce(valor,0)) filter(where lower(status) in ('aprovado','aprovada','paga','approved','paid')) gross,
 sum(valor_liquido) filter(where lower(status) in ('aprovado','aprovada','paga','approved','paid')) net,
 count(*) filter(where lower(status) in ('aprovado','aprovada','paga','approved','paid') and valor_liquido is null) unknown_net,
 count(distinct coalesce(data->>'pedido',external_transaction_id,id)) filter(where lower(status) in ('aprovado','aprovada','paga','approved','paid')) approved_sales,
 count(*) filter(where lower(status) in ('reembolsado','reembolsada','refunded','chargeback')) refunds,
 case when count(*) filter(where lower(status) in ('reembolsado','reembolsada','refunded','chargeback') and valor_liquido is null)=0 then sum(valor_liquido) filter(where lower(status) in ('reembolsado','reembolsada','refunded','chargeback')) end refunded_net,
 count(distinct coalesce(data->>'pedido',external_transaction_id,id)) filter(where attribution_confidence='confirmed' and lower(status) in ('aprovado','aprovada','paga','approved','paid')) attributed_sales
 from s group by project_id,currency,coalesce(attributed_ad_id,'unattributed')
), spend as (
 select project_id,upper(coalesce(moeda,'UNKNOWN')) currency,coalesce(ad_id,'unattributed') ad_id,sum(valor) spend
 from imphq_ads_spend where (p_project_id is null or project_id=p_project_id)
 and data_ref >= (p_since at time zone 'America/Sao_Paulo')::date and data_ref <= ((p_until at time zone 'America/Sao_Paulo')-interval '1 microsecond')::date
 group by project_id,upper(coalesce(moeda,'UNKNOWN')),coalesce(ad_id,'unattributed')
), financial as (
 select coalesce(a.project_id,b.project_id) project_id,coalesce(a.currency,b.currency) currency,coalesce(a.ad_id,b.ad_id) ad_id,
 case when coalesce(a.currency,b.currency)<>'UNKNOWN' then coalesce(a.gross,0) end gross,case when coalesce(a.currency,b.currency)<>'UNKNOWN' and coalesce(a.unknown_net,0)=0 then coalesce(a.net,0) end net,coalesce(a.unknown_net,0) unknown_net,
 coalesce(a.approved_sales,0) approved_sales,coalesce(a.refunds,0) refunds,case when a.currency<>'UNKNOWN' then a.refunded_net end refunded_net,case when b.currency<>'UNKNOWN' then b.spend end spend,
 case when a.ad_id<>'unattributed' and a.currency<>'UNKNOWN' and (p_since at time zone 'America/Sao_Paulo')::time='00:00:00'::time and (p_until at time zone 'America/Sao_Paulo')::time='00:00:00'::time and coalesce(a.unknown_net,0)=0 and b.spend is not null then coalesce(a.net,0)-b.spend end profit_after_media,coalesce(a.attributed_sales,0) attributed_sales
 from sales a full join spend b using(project_id,currency,ad_id)
), vs as (
 select project_id,coalesce(meta->>'player_id','unknown') player_id,
 count(distinct session_id) filter(where step='vsl_view') views, count(distinct session_id) filter(where step='vsl_instrumented') instrumented_sessions,
 case when bool_or(step='vsl_instrumented' and meta->>'retention_configured'='true') then count(distinct session_id) filter(where step='vsl_play') end plays,
 case when bool_or(step='vsl_instrumented' and meta->>'pitch_configured'='true') then count(distinct session_id) filter(where step='vsl_pitch') end pitch,
 case when bool_or(step='vsl_instrumented' and meta->>'retention_configured'='true') then count(distinct session_id) filter(where step='vsl_25') end reached_25,case when bool_or(step='vsl_instrumented' and meta->>'retention_configured'='true') then count(distinct session_id) filter(where step='vsl_50') end reached_50,
 case when bool_or(step='vsl_instrumented' and meta->>'retention_configured'='true') then count(distinct session_id) filter(where step='vsl_75') end reached_75,case when bool_or(step='vsl_instrumented' and meta->>'retention_configured'='true') then count(distinct session_id) filter(where step='vsl_90') end reached_90
 from e where step like 'vsl_%' group by project_id,coalesce(meta->>'player_id','unknown')
)
select jsonb_build_object('measured_at',now(),'since',p_since,'until',p_until,
 'quality',jsonb_build_object('events',(select count(*) from e),'sessions',(select count(distinct session_id) from e),
 'missing_event_ids',(select count(*) from e where event_id is null),'missing_click_ids',(select count(*) from e where click_id is null),
 'missing_creative_ids',(select count(*) from e where creative_id is null and step<>'heartbeat'),
 'unattributed_sales',(select count(*) from s where attribution_confidence='unknown'), 'latest_event_at',(select max(created_at) from e),
 'webhook_failures',(select count(*) from imphq_webhook_errors where (p_project_id is null or project_id=p_project_id) and created_at>=p_since and created_at<p_until),
 'unprocessed_hw',(select count(*) from imphq_webhooks where plataforma='H&W' and (p_project_id is null or project_id=p_project_id) and created_at>=p_since and created_at<p_until and not coalesce(processado,false))),
 'financial',coalesce((select jsonb_agg(to_jsonb(f) order by project_id,currency,ad_id) from financial f),'[]'::jsonb),
 'vsl',coalesce((select jsonb_agg(to_jsonb(v)) from vs v),'[]'::jsonb)) $$;
revoke all on function public.imphq_tracker_report(text,timestamptz,timestamptz) from public,anon;
grant execute on function public.imphq_tracker_report(text,timestamptz,timestamptz) to authenticated,service_role;

create or replace function public.imphq_product_revenue(p_project_id text,p_since timestamptz)
returns jsonb language sql stable security invoker set search_path=public as $$
with s as(select * from imphq_tracker_sales where project_id=p_project_id and data_venda>=p_since and lower(status) in ('aprovado','aprovada','paga','approved','paid') and lower(coalesce(data->>'validation','false'))<>'true' and lower(coalesce(utm_source,''))<>'codex-validation'),
p as(select lower(trim(produto_nome)) key,min(produto_nome) produto,count(*) vendas,
 case when count(distinct currency)=1 and min(currency)<>'UNKNOWN' and count(*) filter(where valor_liquido is null)=0 then sum(valor_liquido) end receita,
 case when count(distinct currency)=1 and min(currency)<>'UNKNOWN' then min(currency) end currency from s where nullif(trim(produto_nome),'') is not null group by lower(trim(produto_nome)))
select jsonb_build_object('currency',case when count(distinct currency)=1 and min(currency)<>'UNKNOWN' then min(currency) end,
 'total',case when count(distinct currency)<=1 and coalesce(min(currency),'BRL')<>'UNKNOWN' and count(*) filter(where valor_liquido is null)=0 then coalesce(sum(valor_liquido),0) end,
 'vendas',count(*),'unknown_net',count(*) filter(where valor_liquido is null),
 'porProduto',coalesce((select jsonb_object_agg(key,jsonb_build_object('produto',produto,'receita',receita,'vendas',vendas,'ticket',receita/nullif(vendas,0),'currency',currency)) from p),'{}'::jsonb)) from s $$;
revoke all on function public.imphq_product_revenue(text,timestamptz) from public,anon;
grant execute on function public.imphq_product_revenue(text,timestamptz) to authenticated,service_role;

-- Correct source freshness without changing any other machine-room field.
do $$ declare d text; begin
 select pg_get_functiondef('public.imphq_machine_room()'::regprocedure) into d;
 d:=replace(d,'''ultimo_evento'', (select max(created_at) from imphq_events e where e.project_id = p.id)',
 '''ultimo_evento'', greatest((select max(created_at) from imphq_events e where e.project_id = p.id and lower(coalesce(e.utm_source,''''))<>''codex-validation'' and lower(coalesce(e.metadata->>''validation'',''false''))<>''true''),(select max(created_at) from imphq_funnel_events e where e.project_id=p.id and lower(coalesce(e.utm_source,''''))<>''codex-validation'' and lower(coalesce(e.meta->>''validation'',''false''))<>''true''))');
 if position('from imphq_funnel_events e where e.project_id=p.id' in d)=0 then raise exception 'machine_room_patch_not_applied'; end if;
 execute d;
end $$;

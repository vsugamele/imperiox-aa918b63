-- All fixtures are isolated in one transaction and rolled back. No checkout, CAPI or messaging call.
begin;
do $$
declare prefix text:='TRK_QA_'||gen_random_uuid(); eid text:=gen_random_uuid()::text; cid text:=gen_random_uuid()::text; sid text:=gen_random_uuid()::text;
 ev jsonb; first_result jsonb; second_result jsonb; sold jsonb; sale_id text; stamp timestamptz:=now(); value numeric; n bigint;
begin
 ev:=jsonb_build_object('project_id','leaftide','session_id',sid,'event_id',eid,'click_id',cid,'event_at',stamp,'step','vsl_view','page_url','https://leaftide-powder-vsl.vercel.app/','meta',jsonb_build_object('tracker_version','TRK1.1','validation',true));
 first_result:=imphq_ingest_funnel_event(ev,'https://leaftide-powder-vsl.vercel.app');
 second_result:=imphq_ingest_funnel_event(ev,'https://leaftide-powder-vsl.vercel.app');
 if first_result->>'ok'<>'true' or second_result->>'duplicate'<>'true' then raise exception 'idempotency failed'; end if;
 select count(*) into n from imphq_funnel_events where project_id='leaftide' and event_id=eid;
 if n<>1 then raise exception 'duplicate stored'; end if;
 sold:=jsonb_build_object('project_id','leaftide','produto_nome',prefix,'external_transaction_id',prefix||':sku','status','pendente','valor',100,'valor_liquido',0,'click_id',cid,'data_venda',stamp-interval '1 day','tipo_venda','principal','data',jsonb_build_object('moeda','USD','comissao_produtor',0,'provider_event_at',stamp));
 sale_id:=imphq_upsert_hw_sale(sold)->>'id';
 select valor_liquido into value from imphq_vendas where id=sale_id;
 if value<>0 then raise exception 'zero commission replaced'; end if;
 if (select attribution_confidence from imphq_tracker_sales where id=sale_id)<>'unknown' then raise exception 'QA event used as attribution'; end if;
 perform imphq_upsert_hw_sale(sold||jsonb_build_object('status','aprovado','data_venda',stamp,'data',jsonb_build_object('moeda','USD','comissao_produtor',0,'provider_event_at',stamp)));
 if (select data_venda from imphq_vendas where id=sale_id)<>stamp then raise exception 'approval time not used'; end if;
 perform imphq_upsert_hw_sale(sold);
 if (select status from imphq_vendas where id=sale_id)<>'aprovado' then raise exception 'paid state regressed'; end if;
 perform imphq_upsert_hw_sale(sold||jsonb_build_object('status','reembolsado','data',jsonb_build_object('moeda','USD','comissao_produtor',null,'provider_event_at',stamp+interval '1 second')));
 if (select valor_liquido from imphq_vendas where id=sale_id) is not null then raise exception 'unknown commission fabricated'; end if;
 perform imphq_upsert_hw_sale(sold||jsonb_build_object('status','aprovado'));
 if (select status from imphq_vendas where id=sale_id)<>'reembolsado' then raise exception 'refund state regressed'; end if;
 -- A client-declared confirmed flag alone cannot prove a matching journey.
 sold:=sold||jsonb_build_object('external_transaction_id',prefix||':other','status','aprovado','data_venda',stamp,'data',jsonb_build_object('moeda','UNKNOWN','comissao_produtor',50,'tracker',jsonb_build_object('confidence','confirmed','ad_id',prefix)));
 sale_id:=imphq_upsert_hw_sale(sold)->>'id';
 if (select attribution_confidence from imphq_tracker_sales where id=sale_id)<>'unknown' then raise exception 'unverified marker confirmed'; end if;
 if (imphq_product_revenue('leaftide',stamp-interval '1 minute')->>'total') is not null then raise exception 'unknown currency summed'; end if;
 -- Genuine matching click is scoped to project and time, excluding heartbeat/QA.
 perform imphq_ingest_funnel_event(ev||jsonb_build_object('event_id',gen_random_uuid(),'meta',jsonb_build_object('tracker_version','TRK1.1','validation',false)),'https://leaftide-powder-vsl.vercel.app');
 if (select attribution_confidence from imphq_tracker_sales where id=sale_id)<>'confirmed' then raise exception 'matching click not confirmed'; end if;
 -- Registered links retain one click per journey, with no cross-project or QA contamination.
 insert into imphq_tracking_links(id,nome,project_id,destino) values(prefix||'_link',prefix,'leaftide','https://leaftide-powder-vsl.vercel.app/');
 ev:=ev||jsonb_build_object('meta',jsonb_build_object('tracker_version','TRK1.1','validation',false,'link_id',prefix||'_link'));
 perform imphq_ingest_funnel_event(ev||jsonb_build_object('event_id',gen_random_uuid()),'https://leaftide-powder-vsl.vercel.app');
 perform imphq_ingest_funnel_event(ev||jsonb_build_object('event_id',gen_random_uuid()),'https://leaftide-powder-vsl.vercel.app');
 if (select count(*) from imphq_clicks where id=cid and link_id=prefix||'_link' and project_id='leaftide')<>1 then raise exception 'legacy link not deduplicated'; end if;
 perform imphq_ingest_funnel_event(ev||jsonb_build_object('event_id',gen_random_uuid(),'click_id',prefix||'_qa','meta',jsonb_build_object('tracker_version','TRK1.1','validation',true,'link_id',prefix||'_link')),'https://leaftide-powder-vsl.vercel.app');
 if exists(select 1 from imphq_clicks where id=prefix||'_qa') then raise exception 'QA inflated legacy clicks'; end if;
 perform imphq_ingest_funnel_event(ev||jsonb_build_object('event_id',gen_random_uuid(),'project_id','memoflow','click_id',prefix||'_cross'),'https://memoflow-vsl.vercel.app');
 if exists(select 1 from imphq_clicks where id=prefix||'_cross') then raise exception 'link crossed projects'; end if;
 insert into imphq_tracking_links(id,nome,destino) values(prefix||'_global',prefix,'https://leaftide-powder-vsl.vercel.app/');
 perform imphq_ingest_funnel_event(ev||jsonb_build_object('event_id',gen_random_uuid(),'click_id',prefix||'_global_click','meta',jsonb_build_object('tracker_version','TRK1.1','link_id',prefix||'_global')),'https://leaftide-powder-vsl.vercel.app');
 if not exists(select 1 from imphq_clicks where id=prefix||'_global_click' and project_id='leaftide') then raise exception 'unassigned link lost'; end if;
end $$;
rollback;
select 'TRK1.1 SQL assertions passed; fixtures rolled back' result;

-- Integration replay using existing source rows. Transaction always rolls back.
-- No provider/CRM calls, no real sale mutation, no message sends.
begin;
set local statement_timeout='20s';
do $$
declare v_source record; v_newer record; v_result jsonb; v_status text;
begin
  if has_function_privilege('anon','public.jp_record_conversation_event(text,uuid,uuid,text,jsonb)','execute')
    or has_function_privilege('authenticated','public.jp_record_conversation_event(text,uuid,uuid,text,jsonb)','execute') then raise exception 'JP_RPC_EXPOSED'; end if;
  select m.id,m.conversation_id,m.content,m.created_at into strict v_newer
    from public.imphq_wa_messages m join public.imphq_wa_conversations c on c.id=m.conversation_id
    where c.project_id='jp_freitas' and c.jid_suffix='s.whatsapp.net' and m.from_me=false and m.direction='incoming'
      and exists(select 1 from public.imphq_wa_messages old where old.conversation_id=c.id and old.from_me=false and old.direction='incoming' and old.created_at<m.created_at)
      and not exists(select 1 from public.imphq_jp_conversation_state s where s.conversation_id=c.id)
    order by m.created_at desc limit 1;
  select id,conversation_id,content,created_at into strict v_source from public.imphq_wa_messages
    where conversation_id=v_newer.conversation_id and from_me=false and direction='incoming' and created_at<v_newer.created_at order by created_at desc limit 1;
  v_result:=public.jp_record_conversation_event('whatsapp',v_source.conversation_id,v_source.id,'turn',jsonb_build_object('mode','suporte','support_kind','access','support_confirmed',false,'facts',jsonb_build_object('seeking',jsonb_build_object('value',left(v_source.content,80),'evidence',left(v_source.content,80)))));
  if not (v_result->>'recorded')::boolean then raise exception 'JP_FIRST_TURN_NOT_RECORDED'; end if;
  v_result:=public.jp_record_conversation_event('whatsapp',v_source.conversation_id,v_source.id,'turn','{}');
  if (v_result->>'recorded')::boolean then raise exception 'JP_DUPLICATE_TURN'; end if;
  perform public.jp_record_conversation_event('whatsapp',v_source.conversation_id,v_source.id,'access_link_sent','{"action_confirmed":true}');
  select support_status into v_status from public.imphq_jp_conversation_state where channel='whatsapp' and conversation_id=v_source.conversation_id;
  if v_status<>'awaiting_confirmation' then raise exception 'JP_LINK_MARKED_AS_RESOLVED'; end if;
  perform public.jp_record_conversation_event('whatsapp',v_newer.conversation_id,v_newer.id,'turn','{"mode":"suporte","support_kind":"access","support_confirmed":true,"facts":{}}');
  select support_status into v_status from public.imphq_jp_conversation_state where channel='whatsapp' and conversation_id=v_source.conversation_id;
  if v_status<>'confirmed' then raise exception 'JP_CONFIRMATION_NOT_RECORDED'; end if;
  v_result:=public.jp_record_conversation_event('whatsapp',v_source.conversation_id,v_source.id,'handoff_registered','{"action_confirmed":true}');
  if not (v_result->>'stale')::boolean then raise exception 'JP_OLD_ACTION_OVERRIDES_NEW_TURN'; end if;
  select support_status into v_status from public.imphq_jp_conversation_state where channel='whatsapp' and conversation_id=v_source.conversation_id;
  if v_status<>'confirmed' then raise exception 'JP_CONFIRMATION_REGRESSED'; end if;
end $$;

do $$
declare v_source record; v_result jsonb;
begin
  select m.id,m.conversation_id into strict v_source from public.imphq_ig_messages m
    join public.imphq_ig_conversations c on c.id=m.conversation_id join public.imphq_ig_accounts a on a.id=c.account_id
    where a.project_id='jp_freitas' and m.direction='in'
      and not exists(select 1 from public.imphq_jp_conversation_state s where s.conversation_id=c.id)
    order by m.created_at desc limit 1;
  v_result:=public.jp_record_conversation_event('instagram',v_source.conversation_id,v_source.id,'turn','{"mode":"relacionamento","support_confirmed":false,"facts":{}}');
  if not (v_result->>'recorded')::boolean then raise exception 'JP_IG_SOURCE_NOT_RECORDED'; end if;
  begin
    perform public.jp_record_conversation_event('whatsapp',v_source.conversation_id,v_source.id,'turn','{}');
    raise exception 'JP_WRONG_CHANNEL_ACCEPTED';
  exception when others then
    if sqlerrm<>'JP_SOURCE_UNVERIFIED' then raise; end if;
  end;
end $$;

-- Payment replay: only our attribution trigger on a TEMPORARY copy of an actual sale.
create temporary table jp_sale_replay (like public.imphq_vendas including defaults);
create trigger jp_payment_replay after insert or update of status on jp_sale_replay
  for each row execute function public.attribute_venda_to_wa_rules();
do $$
declare v_app public.imphq_wa_rule_applications; v_sale public.imphq_vendas; v_before integer; v_after integer;
begin
  select a.* into strict v_app from public.imphq_wa_rule_applications a
    join public.imphq_vendas v on v.lead_id=a.lead_id and v.project_id=a.project_id
    where a.project_id='jp_freitas' order by a.applied_at desc limit 1;
  select * into strict v_sale from public.imphq_vendas where lead_id=v_app.lead_id and project_id=v_app.project_id limit 1;
  update public.imphq_wa_rule_applications set converted_at=null,venda_id=null,attribution_policy=null,applied_at=now() where id=v_app.id;
  select conversion_count into v_before from public.imphq_wa_project_rules where id=v_app.rule_id;
  v_sale.status:='pix_gerado';
  insert into jp_sale_replay select v_sale.*;
  select conversion_count into v_after from public.imphq_wa_project_rules where id=v_app.rule_id;
  if v_after<>v_before then raise exception 'JP_PIX_COUNTED_AS_SALE'; end if;
  update jp_sale_replay set status='aprovado' where id=v_sale.id;
  select conversion_count into v_after from public.imphq_wa_project_rules where id=v_app.rule_id;
  if v_after<>v_before+1 then raise exception 'JP_APPROVAL_NOT_COUNTED_ONCE'; end if;
  update jp_sale_replay set status='approved' where id=v_sale.id;
  select conversion_count into v_after from public.imphq_wa_project_rules where id=v_app.rule_id;
  if v_after<>v_before+1 then raise exception 'JP_REPEAT_APPROVAL_COUNTED_TWICE'; end if;
end $$;
rollback;
select 'JP1.5 integration replay passed; all changes rolled back' as result;

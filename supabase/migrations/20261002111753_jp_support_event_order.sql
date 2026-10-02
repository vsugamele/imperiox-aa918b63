-- Story JP1.5: protect support actions from a late older turn.
create or replace function public.jp_record_conversation_event(p_channel text,p_conversation_id uuid,p_message_id uuid,p_kind text,p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_project text; v_lead text; v_owner uuid; v_at timestamptz; v_message text;
  v_inserted uuid; v_state public.imphq_jp_conversation_state; v_facts jsonb := '{}';
  v_key text; v_fact jsonb; v_commitments jsonb;
begin
  if p_channel='whatsapp' then
    select c.project_id,coalesce(c.lead_id,l.id),m.created_at,m.content into v_project,v_lead,v_at,v_message
    from public.imphq_wa_conversations c join public.imphq_wa_messages m on m.conversation_id=c.id
    left join public.imphq_leads l on l.phone=c.phone and l.project_id=c.project_id
    where c.id=p_conversation_id and m.id=p_message_id and coalesce(m.from_me,false)=false
      and coalesce(m.direction,'incoming') in ('in','incoming') and c.jid_suffix='s.whatsapp.net';
  elsif p_channel='instagram' then
    select a.project_id,c.lead_id,m.created_at,m.content into v_project,v_lead,v_at,v_message
    from public.imphq_ig_conversations c join public.imphq_ig_accounts a on a.id=c.account_id
    join public.imphq_ig_messages m on m.conversation_id=c.id
    where c.id=p_conversation_id and m.id=p_message_id and m.direction='in';
  end if;
  if v_project is distinct from 'jp_freitas' or v_at is null then raise exception 'JP_SOURCE_UNVERIFIED'; end if;
  if v_lead is not null and not exists(select 1 from public.imphq_leads where id=v_lead and project_id=v_project) then v_lead:=null; end if;
  select user_id into v_owner from public.imphq_projects where id=v_project;
  perform pg_advisory_xact_lock(hashtextextended(p_channel||p_conversation_id::text,0));
  insert into public.imphq_jp_conversation_events(channel,conversation_id,source_message_id,source_message_at,lead_id,kind,evidence)
    values(p_channel,p_conversation_id,p_message_id,v_at,v_lead,p_kind,p_evidence)
    on conflict(channel,source_message_id,kind) do nothing returning id into v_inserted;
  if v_inserted is null then return jsonb_build_object('recorded',false); end if;
  insert into public.imphq_jp_conversation_state(channel,conversation_id,lead_id,owner_id)
    values(p_channel,p_conversation_id,v_lead,v_owner) on conflict do nothing;
  select * into v_state from public.imphq_jp_conversation_state where channel=p_channel and conversation_id=p_conversation_id for update;
  -- Slow/retried old work remains in the audit trail, never replaces the newer active turn.
  if v_state.latest_message_at is not null and (v_at,p_message_id)<(v_state.latest_message_at,v_state.latest_message_id) then
    return jsonb_build_object('recorded',true,'stale',true);
  end if;
  if p_kind='turn' then
    for v_key,v_fact in select key,value from jsonb_each(coalesce(p_evidence->'facts','{}')) loop
      if v_key in ('pain','desire','moment','seeking') and length(v_fact->>'evidence')>=5 and strpos(v_message,v_fact->>'evidence')>0 then
        v_facts:=v_facts||jsonb_build_object(v_key,v_fact||jsonb_build_object('message_id',p_message_id,'observed_at',v_at,'channel',p_channel));
      end if;
    end loop;
    v_commitments:=v_state.pending_commitments;
    if p_evidence->>'support_kind'='commitment' then
      v_commitments:=v_commitments||jsonb_build_object(p_message_id::text,jsonb_build_object('evidence',left(v_message,500),'observed_at',v_at,'channel',p_channel,'status','pending_verification'));
    end if;
    update public.imphq_jp_conversation_state set lead_id=v_lead,owner_id=v_owner,latest_message_at=v_at,latest_message_id=p_message_id,
      decision=p_evidence,facts=facts||v_facts,pending_commitments=v_commitments,
      support_kind=case when p_evidence->>'mode'='suporte' then p_evidence->>'support_kind' else support_kind end,
      support_status=case when (p_evidence->>'support_confirmed')::boolean and support_status='awaiting_confirmation' then 'confirmed'
        when p_evidence->>'mode'='suporte' and (support_status is null or support_status='confirmed') then 'pending' else support_status end,
      support_opened_at=case when p_evidence->>'mode'='suporte' and (support_status is null or support_status='confirmed') then v_at else support_opened_at end,
      support_confirmed_at=case when (p_evidence->>'support_confirmed')::boolean and support_status='awaiting_confirmation' then v_at
        when p_evidence->>'mode'='suporte' and support_status='confirmed' then null else support_confirmed_at end,updated_at=now()
      where channel=p_channel and conversation_id=p_conversation_id;
  else
    update public.imphq_jp_conversation_state set owner_id=v_owner,lead_id=v_lead,latest_message_at=v_at,latest_message_id=p_message_id,
      support_kind=case when p_kind='handoff_registered' then coalesce(p_evidence->>'support_kind',support_kind,'other') else 'access' end,
      support_status=case when p_kind='access_link_sent' then 'awaiting_confirmation' when p_kind='awaiting_email' then 'awaiting_email' else 'handoff' end,
      support_opened_at=coalesce(support_opened_at,v_at),updated_at=now()
      where channel=p_channel and conversation_id=p_conversation_id;
  end if;
  return jsonb_build_object('recorded',true);
end $$;

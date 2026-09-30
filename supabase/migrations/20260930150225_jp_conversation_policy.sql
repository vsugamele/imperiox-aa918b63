-- JP1.1: preserve history; serialize ingestion and replies. Service-role only.
alter table public.imphq_ig_conversations
  add column if not exists ai_reply_lock_token uuid,
  add column if not exists ai_reply_lock_until timestamptz,
  add column if not exists ai_handled_message_id uuid,
  add column if not exists ai_reply_pending_since timestamptz,
  add column if not exists ai_reply_attempts integer not null default 0;

create or replace function public.imphq_ingest_ig_message(
  p_conversation_id uuid, p_direction text, p_type text, p_content text,
  p_media_url text, p_mid text, p_source text, p_created_at timestamptz,
  p_ai_generated boolean default false, p_metadata jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.imphq_ig_messages; message_id uuid; aliases jsonb;
begin
  if p_direction not in ('in','out') or p_source not in ('meta','zernio','outbound-api') then
    raise exception 'invalid message origin';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ig-ingest:' || p_conversation_id::text, 0));
  select m.* into existing from public.imphq_ig_messages m
    where m.conversation_id=p_conversation_id and m.direction=p_direction and (
      (p_mid is not null and (m.mid=p_mid or coalesce(m.metadata->'provider_aliases','[]') @> jsonb_build_array(jsonb_build_object('mid',p_mid))))
      or ((p_content is not null or p_media_url is not null)
        and m.content is not distinct from p_content and m.type=p_type
        and abs(extract(epoch from (m.created_at-p_created_at))) <= case when p_direction='out' then 120 else 10 end
        and coalesce(m.metadata->>'ingest_source',m.metadata->>'source','meta') <> p_source
        and not coalesce(m.metadata->'provider_aliases','[]') @> jsonb_build_array(jsonb_build_object('source',p_source))
        and (p_content is not null or m.media_url=p_media_url))
    ) order by m.created_at desc limit 1;
  aliases := jsonb_build_array(jsonb_build_object('source',p_source,'mid',p_mid));
  if existing.id is not null then
    update public.imphq_ig_messages set
      ai_generated=coalesce(ai_generated,false) or p_ai_generated,
      mid=case when p_source='outbound-api' and p_mid is not null then p_mid else mid end,
      metadata=coalesce(metadata,'{}') || p_metadata || jsonb_build_object('provider_aliases',
        coalesce(metadata->'provider_aliases',jsonb_build_array(jsonb_build_object('source',coalesce(metadata->>'ingest_source','meta'),'mid',mid))) || aliases)
      where id=existing.id;
    return jsonb_build_object('id',existing.id,'inserted',false);
  end if;
  insert into public.imphq_ig_messages(conversation_id,direction,type,content,media_url,mid,status,created_at,ai_generated,metadata)
    values(p_conversation_id,p_direction,p_type,p_content,p_media_url,p_mid,case when p_direction='in' then 'received' else 'sent' end,
      p_created_at,p_ai_generated,p_metadata || jsonb_build_object('ingest_source',p_source,'provider_aliases',aliases)) returning id into message_id;
  if p_direction='in' then
    update public.imphq_ig_conversations set ai_reply_pending_since=coalesce(ai_reply_pending_since,clock_timestamp()),ai_reply_attempts=0 where id=p_conversation_id;
  end if;
  return jsonb_build_object('id',message_id,'inserted',true);
end $$;

create or replace function public.imphq_claim_ig_reply(p_conversation_id uuid, p_message_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare lease uuid:=gen_random_uuid(); c public.imphq_ig_conversations; handled public.imphq_ig_messages; incoming public.imphq_ig_messages;
begin
  select * into c from public.imphq_ig_conversations where id=p_conversation_id for update;
  if c.id is null or c.ai_paused is true or c.ia_ativa is false or c.ai_active is false
     or c.ai_paused_until>clock_timestamp() or c.ai_reply_lock_until>clock_timestamp() then return null; end if;
  if p_message_id is not null then
    select * into incoming from public.imphq_ig_messages where id=p_message_id and conversation_id=p_conversation_id and direction='in';
    if incoming.id is null then return null; end if;
    select * into handled from public.imphq_ig_messages where id=c.ai_handled_message_id;
    if handled.id is not null and (incoming.created_at,incoming.id)<=(handled.created_at,handled.id) then return null; end if;
  end if;
  if p_message_id is not null and c.ai_reply_attempts>=3 then
    update public.imphq_ig_conversations set ai_paused=true,ai_paused_reason='jp_reply_failed_three_times' where id=p_conversation_id;
    insert into public.imphq_notifications(title,message,type,entity_type,entity_id)
      values('Atendimento JP — resposta pendente','Três tentativas sem conclusão. Verificar conversa do Instagram.','warning','ig_conversation',p_conversation_id::text);
    return null;
  end if;
  update public.imphq_ig_conversations set ai_reply_lock_token=lease,ai_reply_lock_until=clock_timestamp()+interval '120 seconds',
    ai_reply_attempts=ai_reply_attempts+case when p_message_id is not null then 1 else 0 end where id=p_conversation_id;
  return lease;
end $$;
create or replace function public.imphq_release_ig_reply(p_conversation_id uuid,p_token uuid,p_handled_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.imphq_ig_conversations set ai_reply_lock_token=null,ai_reply_lock_until=null,
    ai_handled_message_id=coalesce(p_handled_id,ai_handled_message_id),
    ai_reply_pending_since=case when p_handled_id is not null and not exists (
      select 1 from public.imphq_ig_messages m, public.imphq_ig_messages h
      where h.id=p_handled_id and m.conversation_id=p_conversation_id and m.direction='in'
      and (m.created_at,m.id)>(h.created_at,h.id)
    ) then null else ai_reply_pending_since end,
    ai_reply_attempts=case when p_handled_id is not null then 0 else ai_reply_attempts end
    where id=p_conversation_id and ai_reply_lock_token=p_token;
  return found;
end $$;

create or replace function public.imphq_pending_ig_replies()
returns table(conversation_id uuid,ig_user_id text,participant_id text,mid text,content text,created_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id,a.ig_user_id,c.participant_id,m.mid,m.content,m.created_at
  from public.imphq_ig_conversations c join public.imphq_ig_accounts a on a.id=c.account_id
  cross join lateral (select x.* from public.imphq_ig_messages x where x.conversation_id=c.id and x.direction='in' order by x.created_at desc,x.id desc limit 1) m
  where a.project_id='jp_freitas' and c.ai_reply_pending_since is not null
    and c.ai_reply_pending_since>now()-interval '24 hours' and c.ai_reply_pending_since<now()-interval '2 minutes'
    and c.ai_paused is not true and c.ia_ativa is not false and c.ai_active is not false
    and (c.ai_paused_until is null or c.ai_paused_until<now()) and (c.ai_reply_lock_until is null or c.ai_reply_lock_until<now())
  order by c.ai_reply_pending_since limit 20
$$;
revoke all on function public.imphq_ingest_ig_message(uuid,text,text,text,text,text,text,timestamptz,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.imphq_claim_ig_reply(uuid,uuid) from public,anon,authenticated;
revoke all on function public.imphq_release_ig_reply(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.imphq_ingest_ig_message(uuid,text,text,text,text,text,text,timestamptz,boolean,jsonb) to service_role;
grant execute on function public.imphq_claim_ig_reply(uuid,uuid) to service_role;
grant execute on function public.imphq_release_ig_reply(uuid,uuid,uuid) to service_role;
revoke all on function public.imphq_pending_ig_replies() from public,anon,authenticated;
grant execute on function public.imphq_pending_ig_replies() to service_role;

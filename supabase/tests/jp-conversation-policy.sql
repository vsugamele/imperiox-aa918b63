-- JP1.1 integration checks. Existing JP conversation, transaction rollback, no provider send.
-- The only existing message trigger updates the conversation; no network side effects.
begin;
do $$
declare cid uuid; first_msg jsonb; duplicate_msg jsonb; next_msg jsonb; echo_msg jsonb; saved_msg jsonb;
  token uuid; token2 uuid; t timestamptz:=clock_timestamp()+interval '1 hour'; n integer;
begin
  select c.id into cid from public.imphq_ig_conversations c join public.imphq_ig_accounts a on a.id=c.account_id
    where a.project_id='jp_freitas' order by c.last_message_at asc nulls first limit 1;
  if cid is null then raise exception 'No real JP conversation available'; end if;
  update public.imphq_ig_conversations set ai_paused=false,ia_ativa=true,ai_active=true,ai_paused_until=null,
    ai_reply_lock_token=null,ai_reply_lock_until=null,ai_handled_message_id=null,ai_reply_attempts=0,ai_reply_pending_since=null where id=cid;
  first_msg:=public.imphq_ingest_ig_message(cid,'in','text','Sim quero',null,'jp1.1-test-z1','zernio',t);
  if (first_msg->>'inserted')::boolean is not true then raise exception 'First event was not inserted'; end if;
  duplicate_msg:=public.imphq_ingest_ig_message(cid,'in','text','Sim quero',null,'jp1.1-test-m1','meta',t+interval '1 second');
  if (duplicate_msg->>'inserted')::boolean or duplicate_msg->>'id'<>first_msg->>'id' then raise exception 'Cross-provider duplication'; end if;
  next_msg:=public.imphq_ingest_ig_message(cid,'in','text','Sim quero',null,'jp1.1-test-z2','zernio',t+interval '2 seconds');
  if (next_msg->>'inserted')::boolean is not true then raise exception 'Legitimate repeated message lost'; end if;
  token:=public.imphq_claim_ig_reply(cid,(first_msg->>'id')::uuid);
  if token is null then raise exception 'First worker failed to acquire'; end if;
  token2:=public.imphq_claim_ig_reply(cid,(next_msg->>'id')::uuid);
  if token2 is not null then raise exception 'Concurrent second worker acquired'; end if;
  if public.imphq_release_ig_reply(cid,gen_random_uuid(),null) then raise exception 'Wrong token released lock'; end if;
  perform public.imphq_release_ig_reply(cid,token,(first_msg->>'id')::uuid);
  if public.imphq_claim_ig_reply(cid,(first_msg->>'id')::uuid) is not null then raise exception 'Handled message generated again'; end if;
  if not exists(select 1 from public.imphq_ig_conversations where id=cid and ai_reply_pending_since is not null) then raise exception 'New inbound was lost'; end if;
  token:=public.imphq_claim_ig_reply(cid,(next_msg->>'id')::uuid);
  if token is null then raise exception 'New inbound was not claimable'; end if;
  perform public.imphq_release_ig_reply(cid,token,(next_msg->>'id')::uuid);
  if exists(select 1 from public.imphq_ig_conversations where id=cid and ai_reply_pending_since is not null) then raise exception 'Completed inbox remained pending'; end if;
  echo_msg:=public.imphq_ingest_ig_message(cid,'out','text','Mensagem de validação sem envio',null,'jp1.1-echo','meta',t);
  saved_msg:=public.imphq_ingest_ig_message(cid,'out','text','Mensagem de validação sem envio',null,'jp1.1-api','outbound-api',t+interval '1 second',true);
  if echo_msg->>'id'<>saved_msg->>'id' then raise exception 'Outbound echo duplicated'; end if;
  if not exists(select 1 from public.imphq_ig_messages where id=(saved_msg->>'id')::uuid and ai_generated is true and mid='jp1.1-api') then raise exception 'AI provenance/message ID lost'; end if;
  update public.imphq_ig_conversations set ai_reply_attempts=3 where id=cid;
  next_msg:=public.imphq_ingest_ig_message(cid,'in','text','Sim quero',null,'jp1.1-test-z3','zernio',t+interval '20 seconds');
  update public.imphq_ig_conversations set ai_reply_attempts=3 where id=cid;
  if public.imphq_claim_ig_reply(cid,(next_msg->>'id')::uuid) is not null then raise exception 'Fourth failed attempt allowed'; end if;
  if not exists(select 1 from public.imphq_ig_conversations where id=cid and ai_paused is true) then raise exception 'Failure threshold did not pause'; end if;
end $$;
select 'PASS: ingestion, aliases, repeated messages, lease exclusion, pending inbox, outbound provenance, three-failure pause' as validation;
rollback;

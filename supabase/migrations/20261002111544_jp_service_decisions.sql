-- Story JP1.5. Additive evidence trail; no historic rescoring or tag deletion.
create table public.imphq_jp_conversation_state (
  channel text not null check (channel in ('whatsapp','instagram')),
  conversation_id uuid not null,
  project_id text not null default 'jp_freitas' references public.imphq_projects(id),
  lead_id text references public.imphq_leads(id),
  owner_id uuid,
  latest_message_at timestamptz,
  latest_message_id uuid,
  decision jsonb not null default '{}',
  facts jsonb not null default '{}',
  pending_commitments jsonb not null default '{}',
  support_kind text,
  support_status text check (support_status in ('pending','awaiting_email','awaiting_confirmation','handoff','confirmed')),
  support_opened_at timestamptz,
  support_confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (channel,conversation_id)
);
create table public.imphq_jp_conversation_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp','instagram')),
  conversation_id uuid not null,
  source_message_id uuid not null,
  source_message_at timestamptz not null,
  lead_id text,
  kind text not null check (kind in ('turn','awaiting_email','access_link_sent','handoff_registered')),
  evidence jsonb not null,
  created_at timestamptz not null default now(),
  unique(channel,source_message_id,kind)
);
create index imphq_jp_events_period on public.imphq_jp_conversation_events(source_message_at);
alter table public.imphq_jp_conversation_state enable row level security;
alter table public.imphq_jp_conversation_events enable row level security;
revoke all on public.imphq_jp_conversation_state,public.imphq_jp_conversation_events from anon,authenticated;
grant select,insert,update on public.imphq_jp_conversation_state,public.imphq_jp_conversation_events to service_role;

-- Invoker privileges + service-only execution; resolve project, lead, owner and timestamp from source rows.
create function public.jp_record_conversation_event(p_channel text,p_conversation_id uuid,p_message_id uuid,p_kind text,p_evidence jsonb)
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
    update public.imphq_jp_conversation_state set owner_id=v_owner,lead_id=v_lead,
      support_kind=case when p_kind='handoff_registered' then coalesce(p_evidence->>'support_kind',support_kind,'other') else 'access' end,
      support_status=case when p_kind='access_link_sent' then 'awaiting_confirmation' when p_kind='awaiting_email' then 'awaiting_email' else 'handoff' end,
      support_opened_at=coalesce(support_opened_at,v_at),updated_at=now()
      where channel=p_channel and conversation_id=p_conversation_id;
  end if;
  return jsonb_build_object('recorded',true);
end $$;
-- The legacy trigger is INSERT-only; approval commonly arrives as an UPDATE.
create trigger trg_jp_attribute_approved_update after update of status on public.imphq_vendas
  for each row when (new.project_id='jp_freitas' and old.status is distinct from new.status)
  execute function public.attribute_venda_to_wa_rules();
revoke all on function public.jp_record_conversation_event(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.jp_record_conversation_event(text,uuid,uuid,text,jsonb) to service_role;

-- Preserve behavior outside JP. JP conversion is a new approved payment, once, inside the same project.
alter table public.imphq_wa_rule_applications add column attribution_policy text;
create or replace function public.attribute_venda_to_wa_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_paid_at timestamptz;
begin
  if new.lead_id is null then return new; end if;
  if new.project_id='jp_freitas' then
    if new.status not in ('aprovado','aprovada','paga','approved','paid') or new.status is null then return new; end if;
    if tg_op='UPDATE' and old.status in ('aprovado','aprovada','paga','approved','paid') then return new; end if;
    if exists(select 1 from public.imphq_wa_rule_applications where project_id=new.project_id and venda_id=new.id and attribution_policy='JP1.5') then return new; end if;
    v_paid_at:=case when tg_op='UPDATE' then now() else least(coalesce(new.data_venda,now()),now()) end;
    with changed as (
      update public.imphq_wa_rule_applications app set converted_at=v_paid_at,venda_id=new.id::text,attribution_policy='JP1.5'
      where app.lead_id=new.lead_id::text and app.project_id=new.project_id and app.converted_at is null
        and app.applied_at between v_paid_at-interval '7 days' and v_paid_at
      returning app.rule_id
    ) update public.imphq_wa_project_rules r set conversion_count=conversion_count+1
      where r.project_id=new.project_id and r.id in (select rule_id from changed);
    return new;
  end if;
  update public.imphq_wa_rule_applications app set converted_at=now(),venda_id=new.id::text
    where app.lead_id=new.lead_id::text and app.converted_at is null and app.applied_at>=now()-interval '7 days';
  update public.imphq_wa_project_rules r set conversion_count=conversion_count+1
    where r.id in(select app.rule_id from public.imphq_wa_rule_applications app where app.venda_id=new.id::text);
  return new;
end $$;

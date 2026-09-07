-- CSX1.3: authenticated review workspace; no outbound Meta delivery.
create table public.imphq_cinna_x1_configs (
  project_id text primary key references public.imphq_projects(id),
  config jsonb not null check (config->>'product' = 'cinna-shield'),
  revision integer not null default 1 check (revision > 0),
  model text not null default 'google/gemini-2.5-flash',
  updated_at timestamptz not null default now()
);
create table public.imphq_cinna_x1_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.imphq_cinna_x1_configs(project_id),
  owner_id uuid not null references auth.users(id),
  mode text not null default 'test' check (mode = 'test'),
  flow_config jsonb not null,
  model text not null,
  state jsonb not null,
  initial_decision jsonb not null,
  revision integer not null check (revision >= 0),
  lock_token uuid,
  lock_until timestamptz,
  lock_event text,
  lock_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cinna_x1_sessions_owner_created on public.imphq_cinna_x1_sessions(owner_id,created_at desc);
create table public.imphq_cinna_x1_turns (
  session_id uuid not null references public.imphq_cinna_x1_sessions(id),
  event_id text not null check (length(event_id) between 1 and 180),
  message_hash text not null,
  input_text text not null,
  decision jsonb not null,
  created_at timestamptz not null default now(),
  primary key(session_id,event_id)
);
alter table public.imphq_cinna_x1_configs enable row level security;
alter table public.imphq_cinna_x1_sessions enable row level security;
alter table public.imphq_cinna_x1_turns enable row level security;
create policy cinna_config_admin_read on public.imphq_cinna_x1_configs for select to authenticated
using (exists(select 1 from public.imphq_user_roles r where r.user_id=auth.uid() and r.role='admin' and r.status='approved'));
create policy cinna_session_owner_read on public.imphq_cinna_x1_sessions for select to authenticated
using (owner_id=auth.uid() and exists(select 1 from public.imphq_user_roles r where r.user_id=auth.uid() and r.role='admin' and r.status='approved'));
create policy cinna_turn_owner_read on public.imphq_cinna_x1_turns for select to authenticated
using (exists(select 1 from public.imphq_cinna_x1_sessions s where s.id=session_id and s.owner_id=auth.uid()));
revoke all on public.imphq_cinna_x1_configs, public.imphq_cinna_x1_sessions, public.imphq_cinna_x1_turns from anon,authenticated;
grant select on public.imphq_cinna_x1_configs, public.imphq_cinna_x1_sessions, public.imphq_cinna_x1_turns to authenticated;
grant all on public.imphq_cinna_x1_configs, public.imphq_cinna_x1_sessions, public.imphq_cinna_x1_turns to service_role;

create function public.cinna_x1_start(p_owner uuid, p_config_revision integer, p_decision jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.imphq_cinna_x1_configs; new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
  select * into strict c from public.imphq_cinna_x1_configs where project_id='cinna-shield';
  if c.revision <> p_config_revision then raise exception 'config_conflict'; end if;
  if (select count(*) from public.imphq_cinna_x1_sessions where owner_id=p_owner and created_at>now()-interval '1 day') >= 50 then raise exception 'session_limit'; end if;
  if p_decision->'state'->>'version' is distinct from c.config->>'version' then raise exception 'version_conflict'; end if;
  insert into public.imphq_cinna_x1_sessions(project_id,owner_id,flow_config,model,state,initial_decision,revision)
  values(c.project_id,p_owner,c.config,c.model,p_decision->'state',p_decision,(p_decision->'state'->>'revision')::integer) returning id into new_id;
  return new_id;
end $$;

create function public.cinna_x1_claim(p_session uuid,p_owner uuid,p_revision integer,p_event text,p_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.imphq_cinna_x1_sessions; t public.imphq_cinna_x1_turns; token uuid;
begin
  if p_event is null or p_hash is null or length(p_event) not between 1 and 180 or length(p_hash)<>64 then raise exception 'invalid_event'; end if;
  select * into s from public.imphq_cinna_x1_sessions where id=p_session and owner_id=p_owner for update;
  if not found then raise exception 'session_not_found'; end if;
  select * into t from public.imphq_cinna_x1_turns where session_id=p_session and event_id=p_event;
  if found then
    if t.message_hash<>p_hash then raise exception 'event_conflict'; end if;
    return jsonb_build_object('replay',true,'decision',t.decision);
  end if;
  if p_revision is null or s.revision <> p_revision or s.lock_until > now() then raise exception 'turn_conflict'; end if;
  if (select count(*) from public.imphq_cinna_x1_turns where session_id=p_session)>=1000 then raise exception 'turn_limit'; end if;
  token:=gen_random_uuid();
  update public.imphq_cinna_x1_sessions set lock_token=token,lock_until=now()+interval '60 seconds',lock_event=p_event,lock_hash=p_hash where id=p_session;
  return jsonb_build_object('replay',false,'token',token,'state',s.state,'config',s.flow_config,'model',s.model);
end $$;

create function public.cinna_x1_finish(p_session uuid,p_owner uuid,p_token uuid,p_message text,p_decision jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.imphq_cinna_x1_sessions; next_revision integer;
begin
  select * into s from public.imphq_cinna_x1_sessions where id=p_session and owner_id=p_owner for update;
  if not found then raise exception 'session_not_found'; end if;
  if p_token is null or s.lock_until is null or s.lock_token is distinct from p_token or s.lock_until<=now() then raise exception 'lease_expired'; end if;
  next_revision:=(p_decision->'state'->>'revision')::integer;
  if next_revision is null or next_revision not between s.revision and s.revision+1 then raise exception 'revision_conflict'; end if;
  insert into public.imphq_cinna_x1_turns(session_id,event_id,message_hash,input_text,decision)
  values(s.id,s.lock_event,s.lock_hash,case when p_decision->>'intent'='medical' then '[health question omitted]' else left(p_message,2000) end,p_decision);
  update public.imphq_cinna_x1_sessions set state=p_decision->'state',revision=next_revision,lock_token=null,lock_until=null,lock_event=null,lock_hash=null,updated_at=now() where id=s.id;
end $$;

revoke all on function public.cinna_x1_start(uuid,integer,jsonb),public.cinna_x1_claim(uuid,uuid,integer,text,text),public.cinna_x1_finish(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.cinna_x1_start(uuid,integer,jsonb),public.cinna_x1_claim(uuid,uuid,integer,text,text),public.cinna_x1_finish(uuid,uuid,uuid,text,jsonb) to service_role;

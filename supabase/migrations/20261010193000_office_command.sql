-- OFFICE1.7: isolated, owner-scoped command channel; no existing tables modified.
create table public.imphq_office_devices (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null, token_hash text not null check(length(token_hash)=64),
 businesses text[] not null default array['imperio','consultoria-bandeiras'],
 enabled boolean not null default true, last_seen timestamptz,
 snapshot jsonb not null default '{"rooms":[],"agents":[]}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.imphq_office_commands (
 id uuid primary key, device_id uuid not null references public.imphq_office_devices(id),
 created_by uuid not null references auth.users(id), agent_id text not null, session_id text not null,
 business_id text not null, kind text not null check(kind in ('message','decision')),
 payload jsonb not null, status text not null default 'queued'
 check(status in ('queued','dispatching','delivered','failed','expired','unknown')),
 result jsonb, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '45 seconds', finished_at timestamptz
);
create index imphq_office_commands_device_created on public.imphq_office_commands(device_id,created_at desc);
alter table public.imphq_office_devices enable row level security;
alter table public.imphq_office_commands enable row level security;
revoke all on public.imphq_office_devices,public.imphq_office_commands from anon,authenticated;

create function public.imphq_office_read() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('serverTime',now(),'devices',coalesce((
 select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'lastSeen',d.last_seen,
 'online',d.enabled and d.last_seen>now()-interval '20 seconds','snapshot',d.snapshot,
 'commands',(select coalesce(jsonb_agg(c),'[]'::jsonb) from (
 select id,agent_id,kind,status,result,created_at,expires_at from public.imphq_office_commands
 where device_id=d.id order by created_at desc limit 30) c)))
 from public.imphq_office_devices d where d.owner_id=auth.uid() and exists(
 select 1 from public.imphq_user_roles r where r.user_id=auth.uid() and r.role='admin' and r.status='approved')),'[]'::jsonb));
$$;

create function public.imphq_office_enqueue(p_id uuid,p_device uuid,p_agent text,p_session text,p_business text,p_kind text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.imphq_office_devices; a jsonb; prior public.imphq_office_commands;
begin
 select * into d from public.imphq_office_devices where id=p_device and owner_id=auth.uid() for update;
 if not found or not exists(select 1 from public.imphq_user_roles where user_id=auth.uid() and role='admin' and status='approved') then
 raise exception 'Acesso ao computador não autorizado' using errcode='42501'; end if;
 select * into prior from public.imphq_office_commands where id=p_id;
 if found then
 if prior.device_id=p_device and prior.created_by=auth.uid() and prior.agent_id=p_agent and prior.session_id=p_session
 and prior.business_id=p_business and prior.kind=p_kind and prior.payload=p_payload then return p_id; end if;
 raise exception 'Identificador já utilizado'; end if;
 if not d.enabled or d.last_seen is null or d.last_seen<now()-interval '20 seconds' then raise exception 'Computador desconectado'; end if;
 if not p_business=any(d.businesses) then raise exception 'Empresa não autorizada'; end if;
 select x into a from jsonb_array_elements(d.snapshot->'agents') x where x->>'id'=p_agent
 and x->>'sessionId'=p_session and x->>'businessId'=p_business and x->>'status' not in ('offline','done');
 if a is null then raise exception 'Sessão indisponível ou empresa diferente'; end if;
 if p_kind='message' then
 if not coalesce((a->>'canMessage')::boolean,false) or jsonb_typeof(p_payload->'text') is distinct from 'string'
 or length(btrim(p_payload->>'text')) not between 1 and 4000 then raise exception 'Mensagem indisponível ou inválida'; end if;
 elsif p_kind='decision' then
 if a->'permission'->>'id' is null or p_payload->>'permissionId' is distinct from a->'permission'->>'id'
 or coalesce(p_payload->'decision'->>'behavior','') not in ('allow','deny','answer','terminal') then raise exception 'Pendência indisponível ou inválida'; end if;
 else raise exception 'Tipo de instrução inválido'; end if;
 if (select count(*) from public.imphq_office_commands where device_id=p_device and created_at>now()-interval '1 minute')>=10 then
 raise exception 'Limite de instruções: aguarde um minuto'; end if;
 insert into public.imphq_office_commands(id,device_id,created_by,agent_id,session_id,business_id,kind,payload)
 values(p_id,p_device,auth.uid(),p_agent,p_session,p_business,p_kind,p_payload);
 return p_id;
end $$;

create function public.imphq_office_sync(p_device uuid,p_token text,p_snapshot jsonb,p_receipts jsonb default '[]')
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.imphq_office_devices; receipt jsonb; jobs jsonb;
begin
 select * into d from public.imphq_office_devices where id=p_device and enabled
 and token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or not exists(select 1 from public.imphq_user_roles where user_id=d.owner_id and role='admin' and status='approved') then
 raise exception 'Dispositivo não autorizado' using errcode='42501'; end if;
 if pg_column_size(p_snapshot)>524288 or jsonb_typeof(p_receipts) is distinct from 'array' or jsonb_array_length(p_receipts)>50 then
 raise exception 'Pacote inválido'; end if;
 for receipt in select * from jsonb_array_elements(p_receipts) loop
 update public.imphq_office_commands set status=receipt->>'status',result=receipt->'result',finished_at=now()
 where device_id=d.id and id=(receipt->>'id')::uuid and status='dispatching'
 and receipt->>'status' in ('delivered','failed','unknown');
 end loop;
 update public.imphq_office_commands set status='expired',finished_at=now() where device_id=d.id and status='queued' and expires_at<=now();
 update public.imphq_office_commands set status='unknown',finished_at=now() where device_id=d.id and status='dispatching' and created_at<now()-interval '2 minutes';
 if p_snapshot is null then return '[]'::jsonb; end if;
 if jsonb_typeof(p_snapshot->'agents') is distinct from 'array' or jsonb_typeof(p_snapshot->'rooms') is distinct from 'array' then raise exception 'Snapshot inválido'; end if;
 update public.imphq_office_devices set snapshot=p_snapshot,last_seen=now() where id=d.id;
 with picked as (select id from public.imphq_office_commands where device_id=d.id and status='queued' and expires_at>now() order by created_at limit 1 for update skip locked),
 claimed as (update public.imphq_office_commands c set status='dispatching' from picked where c.id=picked.id returning c.*)
 select coalesce(jsonb_agg(claimed),'[]'::jsonb) into jobs from claimed;
 return jobs;
end $$;

revoke all on function public.imphq_office_read(),public.imphq_office_enqueue(uuid,uuid,text,text,text,text,jsonb),public.imphq_office_sync(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.imphq_office_read(),public.imphq_office_enqueue(uuid,uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.imphq_office_sync(uuid,text,jsonb,jsonb) to anon,authenticated;

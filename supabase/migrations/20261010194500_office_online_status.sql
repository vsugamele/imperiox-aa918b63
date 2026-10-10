-- A newly paired device must be explicitly offline, never null.
create or replace function public.imphq_office_read() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('serverTime',now(),'devices',coalesce((
 select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'lastSeen',d.last_seen,
 'online',coalesce(d.enabled and d.last_seen>now()-interval '20 seconds',false),'snapshot',d.snapshot,
 'commands',(select coalesce(jsonb_agg(c),'[]'::jsonb) from (
 select id,agent_id,kind,status,result,created_at,expires_at from public.imphq_office_commands
 where device_id=d.id order by created_at desc limit 30) c)))
 from public.imphq_office_devices d where d.owner_id=auth.uid() and exists(
 select 1 from public.imphq_user_roles r where r.user_id=auth.uid() and r.role='admin' and r.status='approved')),'[]'::jsonb));
$$;

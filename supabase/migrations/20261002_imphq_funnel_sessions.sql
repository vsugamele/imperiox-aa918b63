-- Sessões reais do funil de um projeto desde uma data: sessões distintas com algum evento que não seja heartbeat.
-- O mapa (tela e project-mcp) usa isso para decidir se o funil está "rodando"; heartbeat de uma sessão aberta não conta.
create or replace function public.imphq_funnel_sessions(p_project_id text, p_since timestamptz)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct session_id)::integer
  from public.imphq_funnel_events
  where project_id = p_project_id
    and created_at >= p_since
    and step is distinct from 'heartbeat'
    and session_id is not null;
$$;

grant execute on function public.imphq_funnel_sessions(text, timestamptz) to authenticated, service_role;

-- UX1.1: uso real das telas do Império (até aqui ninguém media). Cada mudança de rota grava a rota normalizada
-- (ids viram :id) e quem abriu. Serve para decidir com dado o que volta ao menu e o que pode ser arquivado.
create table if not exists public.imphq_page_views (
  id bigint generated always as identity primary key,
  rota text not null,
  user_id uuid not null default auth.uid(),
  em timestamptz not null default now()
);
create index if not exists imphq_page_views_rota_em_idx on public.imphq_page_views (rota, em desc);

alter table public.imphq_page_views enable row level security;
drop policy if exists "page_views_insert_own" on public.imphq_page_views;
create policy "page_views_insert_own" on public.imphq_page_views for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "page_views_read_team" on public.imphq_page_views;
create policy "page_views_read_team" on public.imphq_page_views for select to authenticated using (true);
grant select, insert on public.imphq_page_views to authenticated;

-- Resumo por rota: visitas, pessoas e última visita nos últimos N dias.
create or replace function public.imphq_page_usage(p_dias int default 30)
returns table (rota text, visitas bigint, pessoas bigint, ultima timestamptz)
language sql stable security invoker as $$
  select rota, count(*) as visitas, count(distinct user_id) as pessoas, max(em) as ultima
  from public.imphq_page_views
  where em > now() - make_interval(days => greatest(1, least(p_dias, 365)))
  group by rota
  order by visitas desc;
$$;
grant execute on function public.imphq_page_usage(int) to authenticated;

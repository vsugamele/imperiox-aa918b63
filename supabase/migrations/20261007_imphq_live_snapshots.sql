-- Leituras do painel ao vivo (LIVE1.2): uma linha por projeto a cada 15 min, gravada pela function live-snapshot.
-- Dá o "vs HH:MM" persistente, o histórico do dia e a base dos alertas no grupo (CPA saiu/voltou ao alvo, pixel × checkout).

create table if not exists public.imphq_live_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  taken_at timestamptz not null default now(),
  dia date not null,
  moeda text,
  gasto numeric,
  faturamento numeric,
  vendas integer,
  cpa numeric,
  zona text,
  roas numeric,
  lucro numeric,
  painel jsonb not null
);

create index if not exists imphq_live_snapshots_project_taken_idx on public.imphq_live_snapshots (project_id, taken_at desc);

alter table public.imphq_live_snapshots enable row level security;
drop policy if exists "auth read live snapshots" on public.imphq_live_snapshots;
create policy "auth read live snapshots" on public.imphq_live_snapshots for select to authenticated using (true);

-- Guarda 30 dias de leituras (a cada 15 min dá ~2,9 mil linhas por projeto por mês).
create or replace function public.imphq_prune_live_snapshots() returns integer language sql security definer set search_path = public as $$
  with gone as (delete from imphq_live_snapshots where taken_at < now() - interval '30 days' returning 1) select count(*)::integer from gone
$$;

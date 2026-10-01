-- Cópias de segurança de um mapa (etapas, conexões e anotações) antes de reorganizações grandes.
-- Uso: select imphq_snapshot_company_map('<map_id>', 'motivo');
create table if not exists public.imphq_company_map_snapshots (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null,
  reason text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists imphq_company_map_snapshots_map_idx on public.imphq_company_map_snapshots (map_id, created_at desc);
alter table public.imphq_company_map_snapshots enable row level security;
drop policy if exists "auth manage map snapshots" on public.imphq_company_map_snapshots;
create policy "auth manage map snapshots" on public.imphq_company_map_snapshots
  for all to authenticated using (true) with check (true);

create or replace function public.imphq_snapshot_company_map(p_map_id uuid, p_reason text)
returns uuid language sql security definer set search_path = public as $$
  insert into imphq_company_map_snapshots (map_id, reason, snapshot)
  select p_map_id, p_reason, jsonb_build_object(
    'map', (select to_jsonb(m) from imphq_company_maps m where m.id = p_map_id),
    'nodes', coalesce((select jsonb_agg(to_jsonb(n)) from imphq_company_map_nodes n where n.map_id = p_map_id), '[]'),
    'edges', coalesce((select jsonb_agg(to_jsonb(e)) from imphq_company_map_edges e where e.map_id::text = p_map_id::text), '[]'),
    'annotations', coalesce((select jsonb_agg(to_jsonb(a)) from imphq_company_map_annotations a where a.map_id = p_map_id), '[]')
  )
  returning id;
$$;
revoke all on function public.imphq_snapshot_company_map(uuid, text) from public, anon;
grant execute on function public.imphq_snapshot_company_map(uuid, text) to authenticated;

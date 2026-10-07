-- Teste A/B/C de página (FUN1.2): o link único divide o tráfego e cada envio fica registrado.
create table if not exists public.imphq_page_splits (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  slug text not null unique,
  nome text not null,
  variantes jsonb not null,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  vencedor text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imphq_split_hits (
  id bigserial primary key,
  split_id uuid not null references public.imphq_page_splits (id) on delete cascade,
  variante text not null,
  nova_visita boolean not null default true,
  utm_source text,
  utm_campaign text,
  utm_content text,
  created_at timestamptz not null default now()
);
create index if not exists imphq_split_hits_split_idx on public.imphq_split_hits (split_id, variante, created_at desc);

alter table public.imphq_page_splits enable row level security;
alter table public.imphq_split_hits enable row level security;
drop policy if exists "page_splits_team" on public.imphq_page_splits;
create policy "page_splits_team" on public.imphq_page_splits for all to authenticated using (true) with check (true);
drop policy if exists "split_hits_read_team" on public.imphq_split_hits;
create policy "split_hits_read_team" on public.imphq_split_hits for select to authenticated using (true);
grant select, insert, update on public.imphq_page_splits to authenticated;
grant select on public.imphq_split_hits to authenticated;

-- Contagem de envios por variante sem trazer as linhas para o navegador.
create or replace function public.imphq_split_counts(p_split_ids uuid[])
returns table (split_id uuid, variante text, enviados bigint, novos bigint)
language sql stable security invoker set search_path = public as $$
  select split_id, variante, count(*), count(*) filter (where nova_visita)
  from public.imphq_split_hits where split_id = any(p_split_ids) group by 1, 2;
$$;
revoke all on function public.imphq_split_counts(uuid[]) from public, anon;
grant execute on function public.imphq_split_counts(uuid[]) to authenticated, service_role;

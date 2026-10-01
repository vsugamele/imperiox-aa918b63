-- Prints das páginas de cada etapa do mapa (gerados por scripts/map-prints.mjs).
-- Bucket público: são prints de páginas públicas (advertorial, VSL, PDP, checkout).
insert into storage.buckets (id, name, public)
values ('map-prints', 'map-prints', true)
on conflict (id) do update set public = true;

-- { desktop, mobile, source_url, captured_at, status, error } do último print da etapa.
alter table public.imphq_company_map_nodes add column if not exists print_meta jsonb;
comment on column public.imphq_company_map_nodes.print_meta is
  'Último print automático da URL da etapa: desktop, mobile, source_url, captured_at, status (ok|error), error. image_url recebe o print desktop só quando estava vazio ou era o print anterior.';

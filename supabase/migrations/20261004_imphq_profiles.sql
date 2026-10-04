-- Perfis (personas) com seus canais — Story OPS2.2. Um perfil junta e-mail, aparelho/proxy, as quatro redes e as
-- páginas do Facebook, no formato da tabela de contas do Centro de Comando. Os 8 perfis do Centro entram por carga única.
create table if not exists public.imphq_profiles (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  project_id text,
  email text,
  maquina text,
  proxy text,
  status text not null default 'inventario' check (status in ('inventario', 'aquecendo', 'ativo', 'pausado', 'bloqueado')),
  aquecimento text,
  publicacao_autorizada boolean not null default false,
  canais jsonb not null default '{}'::jsonb,
  paginas_facebook jsonb not null default '[]'::jsonb,
  fonte text,
  external_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.imphq_profiles enable row level security;
drop policy if exists "auth manage profiles" on public.imphq_profiles;
create policy "auth manage profiles" on public.imphq_profiles for all to authenticated using (true) with check (true);

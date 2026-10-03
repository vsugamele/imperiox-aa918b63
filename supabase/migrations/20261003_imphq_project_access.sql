-- Acessos de cada projeto (LAUNCH1.1): o que o projeto precisa ter conectado para rodar cada canal.
-- Só status, nota e dono da pendência. Senha, token e chave nunca entram aqui.
-- Chaves de acesso e canais: supabase/functions/_shared/launch-kit.ts.

create table if not exists public.imphq_project_access (
  project_id text not null,
  access_key text not null,
  status text not null default 'falta' check (status in ('falta', 'em_andamento', 'conectado', 'nao_se_aplica')),
  nota text,
  owner_member_id uuid references public.imphq_team_members(id) on delete set null,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (project_id, access_key)
);

alter table public.imphq_project_access enable row level security;
drop policy if exists "auth manage project access" on public.imphq_project_access;
create policy "auth manage project access" on public.imphq_project_access for all to authenticated using (true) with check (true);

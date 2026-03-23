create table public.imphq_tools_vault (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  username text,
  password_encrypted text,
  category text default 'geral',
  notes text,
  project_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.imphq_tools_vault enable row level security;

create policy "Authenticated users can manage vault"
  on public.imphq_tools_vault
  for all
  to authenticated
  using (true)
  with check (true);
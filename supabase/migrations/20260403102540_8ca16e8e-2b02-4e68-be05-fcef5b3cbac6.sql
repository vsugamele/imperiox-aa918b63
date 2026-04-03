
create table public.imphq_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  bm_id text not null,
  ad_account_id text not null,
  nome text not null,
  plataforma text default 'Facebook',
  status text default 'ativo',
  notas text,
  created_at timestamptz default now()
);
alter table public.imphq_ad_accounts enable row level security;
create policy "Users manage own ad accounts" on public.imphq_ad_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.imphq_ads_reports (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  titulo text not null default 'Análise de Performance',
  report_data jsonb not null,
  model_used text,
  period_start date,
  period_end date,
  created_at timestamptz default now()
);
alter table public.imphq_ads_reports enable row level security;
create policy "Auth users manage reports" on public.imphq_ads_reports
  for all to authenticated using (true) with check (true);


create table if not exists public.imphq_ai_action_outcomes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.imphq_ai_actions(id) on delete cascade,
  projeto_id text,
  kind text not null,
  source text,
  result text not null check (result in ('success','failure','neutral','reverted')),
  revenue_delta numeric default 0,
  days_to_outcome integer default 0,
  notes text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_outcomes_kind_src on public.imphq_ai_action_outcomes(kind, source, observed_at desc);
create index if not exists idx_ai_outcomes_projeto on public.imphq_ai_action_outcomes(projeto_id, observed_at desc);

grant select, insert, update, delete on public.imphq_ai_action_outcomes to authenticated;
grant all on public.imphq_ai_action_outcomes to service_role;
alter table public.imphq_ai_action_outcomes enable row level security;
create policy "outcomes read auth" on public.imphq_ai_action_outcomes for select to authenticated using (true);
create policy "outcomes write service" on public.imphq_ai_action_outcomes for all to service_role using (true) with check (true);

create table if not exists public.imphq_ai_policy (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global',
  kind text not null,
  source text,
  confidence_floor numeric not null default 0.8,
  auto_exec_threshold numeric not null default 0.8,
  sample_size integer not null default 0,
  success_rate numeric not null default 0,
  failure_rate numeric not null default 0,
  killed boolean not null default false,
  killed_reason text,
  updated_at timestamptz not null default now(),
  unique (scope, kind, source)
);
create index if not exists idx_ai_policy_lookup on public.imphq_ai_policy(kind, source);

grant select on public.imphq_ai_policy to authenticated;
grant all on public.imphq_ai_policy to service_role;
alter table public.imphq_ai_policy enable row level security;
create policy "policy read auth" on public.imphq_ai_policy for select to authenticated using (true);
create policy "policy write service" on public.imphq_ai_policy for all to service_role using (true) with check (true);

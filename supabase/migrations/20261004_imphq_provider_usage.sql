-- Custo por automação (Story OP1.4), parte 1: consumo real por provedor e dia, lido da API de cada conta.
-- Uma linha por provedor e dia (a última leitura do dia vale). Nunca guarda chave: só números e campos de plano.
create table if not exists public.imphq_provider_usage_daily (
  provider text not null,
  usage_date date not null,
  spent_usd numeric(12, 4),
  units_used numeric,
  unit text,
  balance numeric,
  details jsonb not null default '{}'::jsonb,
  read_at timestamptz not null default now(),
  primary key (provider, usage_date)
);

alter table public.imphq_provider_usage_daily enable row level security;
drop policy if exists "auth read provider usage" on public.imphq_provider_usage_daily;
create policy "auth read provider usage" on public.imphq_provider_usage_daily for select to authenticated using (true);

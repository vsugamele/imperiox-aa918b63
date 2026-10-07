-- Fontes de mineração (REF2.2): palavras-chave, páginas de concorrentes ou URLs da Biblioteca de Anúncios por projeto.
create table if not exists public.imphq_mining_sources (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  tipo text not null check (tipo in ('palavra', 'pagina', 'url')),
  valor text not null,
  pais text not null default 'BR',
  limite int not null default 15 check (limite between 1 and 50),
  min_dias int not null default 7,
  ativo boolean not null default true,
  ultima_execucao timestamptz,
  ultimo_resultado jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  unique (project_id, tipo, valor, pais)
);

alter table public.imphq_mining_sources enable row level security;
drop policy if exists "mining_sources_team" on public.imphq_mining_sources;
create policy "mining_sources_team" on public.imphq_mining_sources for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.imphq_mining_sources to authenticated;

create index if not exists imphq_referencias_external_id_idx on public.imphq_referencias (external_id);

-- Uma vez por dia, 06:15 BRT. O pipeline (a cada 10 min) transcreve, lê e classifica o que entrar.
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  perform cron.unschedule(jobname) from cron.job where jobname = 'ref-mining-daily';
  perform cron.schedule('ref-mining-daily', '15 9 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/ref-mining', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"modo":"run"}'::jsonb, timeout_milliseconds := 150000)$c$, k, k));
end $$;

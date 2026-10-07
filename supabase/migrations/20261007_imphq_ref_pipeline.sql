-- Pipeline de referências (REF2.1): estado por passo, formato e leitura estruturada de cada referência.
alter table public.imphq_referencias add column if not exists formato text;
alter table public.imphq_referencias add column if not exists leitura jsonb;
alter table public.imphq_referencias add column if not exists pipeline jsonb not null default '{}'::jsonb;
alter table public.imphq_referencias add column if not exists pipeline_at timestamptz;
create index if not exists imphq_referencias_formato_idx on public.imphq_referencias (formato);

-- Roda a cada 10 minutos em lotes pequenos (anti-loop: 3 tentativas por passo, para após 3 falhas seguidas).
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  perform cron.unschedule(jobname) from cron.job where jobname = 'ref-pipeline-10m';
  perform cron.schedule('ref-pipeline-10m', '*/10 * * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/ref-pipeline', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 150000)$c$, k, k));
end $$;

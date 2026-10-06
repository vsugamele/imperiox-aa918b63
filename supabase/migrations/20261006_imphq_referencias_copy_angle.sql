-- Ângulo da biblioteca de copy em cada referência, classificado pelo Jev (CPY1.3).
-- status: firme (entrou sozinho), duvida (espera alguém do time), sem_angulo, revisado (decidido por pessoa).
alter table public.imphq_referencias add column if not exists copy_lib_id text references public.imphq_copy_library (id) on delete set null;
alter table public.imphq_referencias add column if not exists copy_lib_status text check (copy_lib_status in ('firme', 'duvida', 'sem_angulo', 'revisado'));
alter table public.imphq_referencias add column if not exists copy_lib_conf numeric;
alter table public.imphq_referencias add column if not exists copy_lib_camada text;
alter table public.imphq_referencias add column if not exists copy_lib_alt jsonb;
alter table public.imphq_referencias add column if not exists copy_lib_at timestamptz;
create index if not exists imphq_referencias_copy_lib_idx on public.imphq_referencias (copy_lib_id);
create index if not exists imphq_referencias_copy_status_idx on public.imphq_referencias (copy_lib_status);

-- Classificação automática a cada 6 horas (referências novas e variantes de teste sem etiqueta), no máximo 30 itens por rodada.
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  perform cron.unschedule(jobname) from cron.job where jobname = 'jev-classify-auto';
  perform cron.schedule('jev-classify-auto', '50 */6 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/jev-classify', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"modo":"auto"}'::jsonb, timeout_milliseconds := 120000)$c$, k, k));
end $$;

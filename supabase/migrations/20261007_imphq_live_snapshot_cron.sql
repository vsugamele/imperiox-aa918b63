-- Leitura do painel ao vivo a cada 15 min (LIVE1.2). Mesma chave pública das outras rotinas (copiada do cron do Zernio, como o test-report-wa).
-- Desligar: select cron.alter_job((select jobid from cron.job where jobname = 'live-snapshot-15m'), active := false);
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  if k is null then raise exception 'chave pública não encontrada no cron zernio-ads-sync-daily'; end if;
  perform cron.unschedule(jobname) from cron.job where jobname = 'live-snapshot-15m';
  perform cron.schedule('live-snapshot-15m', '*/15 * * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/live-snapshot', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 60000)$c$, k, k));
end $$;
select jobname, schedule, active from cron.job where jobname = 'live-snapshot-15m';

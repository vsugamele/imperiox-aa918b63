-- Operador diário (OPR1.1): rodadas às 09:30, 14:00 e 19:30 BRT (12:30, 17:00 e 22:30 UTC). Ligado com OK do Vinicius (07/10).
-- Mesma chave pública das outras rotinas (copiada do cron do Zernio, como live-snapshot e test-report-wa).
-- Desligar: select cron.alter_job(jobid, active := false) from cron.job where jobname like 'operator-round-%';
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  if k is null then raise exception 'chave pública não encontrada no cron zernio-ads-sync-daily'; end if;
  perform cron.unschedule(jobname) from cron.job where jobname in ('operator-round-0930brt', 'operator-round-1400brt', 'operator-round-1930brt');
  perform cron.schedule('operator-round-0930brt', '30 12 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/operator-round', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 120000)$c$, k, k));
  perform cron.schedule('operator-round-1400brt', '0 17 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/operator-round', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 120000)$c$, k, k));
  perform cron.schedule('operator-round-1930brt', '30 22 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/operator-round', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 120000)$c$, k, k));
end $$;
select jobname, schedule, active from cron.job where jobname like 'operator-round-%' order by jobname;

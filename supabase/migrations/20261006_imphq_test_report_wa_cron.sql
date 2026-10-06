-- Relatório dos testes de criativos no grupo Imperio X às 10h e 19h BRT (13h e 22h UTC), TST1.3.
-- Usa a mesma chave pública do cron do Zernio; a função só lê dados e envia um texto por teste no ar.
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('test-report-wa-10brt', 'test-report-wa-19brt');
  perform cron.schedule('test-report-wa-10brt', '0 13 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/test-report-wa', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron_10brt"}'::jsonb, timeout_milliseconds := 60000)$c$, k, k));
  perform cron.schedule('test-report-wa-19brt', '0 22 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/test-report-wa', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron_19brt"}'::jsonb, timeout_milliseconds := 60000)$c$, k, k));
end $$;
select jobname, schedule, active from cron.job where jobname like 'test-report-wa%';

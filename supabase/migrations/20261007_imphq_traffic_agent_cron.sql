-- Agente de tráfego (TRF1.1): roda às 09:00 BRT (12:00 UTC), antes da rodada do operador das 09:30, que numera as
-- propostas de pausa para "ok N" no grupo. Substitui o ads-ai-optimizer (Vinicius, 07/10: "Sim, substituir"), que
-- fica desligado (não apagado). Mesma chave pública das outras rotinas (copiada do cron do Zernio).
-- Desligar: select cron.alter_job(jobid, active := false) from cron.job where jobname = 'traffic-agent-0900brt';
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  if k is null then raise exception 'chave pública não encontrada no cron zernio-ads-sync-daily'; end if;
  perform cron.alter_job(jobid, active := false) from cron.job where jobname = 'ads-ai-optimizer';
  perform cron.unschedule(jobname) from cron.job where jobname = 'traffic-agent-0900brt';
  perform cron.schedule('traffic-agent-0900brt', '0 12 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/traffic-agent', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 120000)$c$, k, k));
end $$;
select jobname, schedule, active from cron.job where jobname in ('ads-ai-optimizer', 'traffic-agent-0900brt') order by jobname;

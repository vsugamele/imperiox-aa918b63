-- OF2.1: aviso no grupo Imperio X de lead esperando resposta no WhatsApp há mais de 1 h, a cada 15 min.
-- A função fica em silêncio das 22h às 8h e manda um aviso por espera. Mesma chave pública das outras rotinas.
-- Desligar: select cron.alter_job(jobid, active := false) from cron.job where jobname = 'wa-waiting-alert-15min';
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  if k is null then raise exception 'chave pública não encontrada no cron zernio-ads-sync-daily'; end if;
  perform cron.unschedule(jobname) from cron.job where jobname = 'wa-waiting-alert-15min';
  perform cron.schedule('wa-waiting-alert-15min', '*/15 * * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/wa-waiting-alert', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 60000)$c$, k, k));
end $$;

-- Cliques de links do WhatsApp que já tinham prova (o código do link voltou no aviso da plataforma).
update public.imphq_wa_attribution
   set clicked_at = coalesce(matched_at, sent_at)
 where clicked_at is null and metadata->>'match_method' = 'click_id';

select jobname, schedule, active from cron.job where jobname = 'wa-waiting-alert-15min';

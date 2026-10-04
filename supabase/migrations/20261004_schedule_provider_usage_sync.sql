-- Custo por automação (Story OP1.4): leitura do consumo dos provedores de hora em hora (aos 55 min; a de 23:55 UTC fecha o dia).
-- A chave pública do app é copiada do comando de outra rotina dentro do banco, para não ficar escrita neste arquivo.
-- Desfazer: select cron.unschedule('provider-usage-sync-hourly');
select cron.schedule(
  'provider-usage-sync-hourly',
  '55 * * * *',
  format(
    $f$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/provider-usage-sync', headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', %L, 'Authorization', 'Bearer ' || %L), body := '{}'::jsonb)$f$,
    k, k
  )
)
from (select substring(command from '"apikey":"([^"]+)"') as k from cron.job where jobname = 'hot-lead-responder-5min') s
where k is not null;

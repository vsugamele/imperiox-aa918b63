-- Remove versões anteriores se existirem (idempotente)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('wa-learn-from-sale-15min','rag-indexer-6h');

SELECT cron.schedule(
  'wa-learn-from-sale-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/wa-learn-from-sale',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"limit":20}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'rag-indexer-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/rag-indexer',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"sources":["transcript","sale_winning"]}'::jsonb
  ) AS request_id;
  $$
);
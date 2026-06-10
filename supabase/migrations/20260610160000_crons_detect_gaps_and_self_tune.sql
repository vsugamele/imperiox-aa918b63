-- detect-gaps a cada 2h
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-ai-detect-gaps-2h') THEN
    PERFORM cron.unschedule('wa-ai-detect-gaps-2h');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-ai-detect-gaps-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/wa-ai-detect-gaps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('since_hours', 2)
  );
  $$
);

-- self-tune semanal: segunda 04h BR (07h UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-ai-self-tune-weekly') THEN
    PERFORM cron.unschedule('wa-ai-self-tune-weekly');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-ai-self-tune-weekly',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/wa-ai-self-tune',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

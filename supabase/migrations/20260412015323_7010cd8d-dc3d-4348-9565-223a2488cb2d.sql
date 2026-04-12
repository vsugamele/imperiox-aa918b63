CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobid = 7
  ) THEN
    PERFORM cron.unschedule(7);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'wa-campaign-scheduler'
  ) THEN
    PERFORM cron.unschedule('wa-campaign-scheduler');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-campaign-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/wa-campaign-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
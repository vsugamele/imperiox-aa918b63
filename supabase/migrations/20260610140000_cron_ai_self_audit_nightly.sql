-- Cron noturno: self-audit todo dia às 03:00 BR (06:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-ai-self-audit-nightly') THEN
    PERFORM cron.unschedule('wa-ai-self-audit-nightly');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-ai-self-audit-nightly',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/wa-ai-self-audit',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

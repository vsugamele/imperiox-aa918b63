-- escalation: a cada 20 min
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-ai-decide-escalation-20m') THEN
    PERFORM cron.unschedule('wa-ai-decide-escalation-20m');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-ai-decide-escalation-20m',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/wa-ai-decide-escalation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- drift: semanal, segunda 05h BR (08h UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-ai-persona-drift-weekly') THEN
    PERFORM cron.unschedule('wa-ai-persona-drift-weekly');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-ai-persona-drift-weekly',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/wa-ai-persona-drift',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- conv-scoring: a cada 4h
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-ai-conv-scoring-4h') THEN
    PERFORM cron.unschedule('wa-ai-conv-scoring-4h');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-ai-conv-scoring-4h',
  '15 */4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/wa-ai-conv-scoring',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

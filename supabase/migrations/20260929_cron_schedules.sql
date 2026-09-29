-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: base URL for edge functions
DO $$
DECLARE
  base_url text := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1';
  svc_key text := current_setting('app.settings.service_role_key', true);
BEGIN

  -- 1. Daily Briefing WA — every day at 12:00 UTC (09:00 BRT)
  PERFORM cron.schedule(
    'daily-briefing-wa',
    '0 12 * * *',
    format($$
      SELECT net.http_post(
        url := '%s/daily-briefing-wa',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

  -- 2. Payment Recovery — every 15 minutes
  PERFORM cron.schedule(
    'payment-recovery',
    '*/15 * * * *',
    format($$
      SELECT net.http_post(
        url := '%s/payment-recovery',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

  -- 3. Hot Lead Responder — every 30 minutes
  PERFORM cron.schedule(
    'hot-lead-responder',
    '*/30 * * * *',
    format($$
      SELECT net.http_post(
        url := '%s/hot-lead-responder',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

  -- 4. WA Health Monitor — every 10 minutes
  PERFORM cron.schedule(
    'wa-health-monitor',
    '*/10 * * * *',
    format($$
      SELECT net.http_post(
        url := '%s/wa-health-monitor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

  -- 5. WA Cold Lead Reactivator — daily at 10:00 UTC (07:00 BRT)
  PERFORM cron.schedule(
    'wa-cold-lead-reactivator',
    '0 10 * * *',
    format($$
      SELECT net.http_post(
        url := '%s/wa-cold-lead-reactivator',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

  -- 6. Meta Ads Sync — every 6 hours
  PERFORM cron.schedule(
    'facebook-ads-sync-all',
    '0 */6 * * *',
    format($$
      SELECT net.http_post(
        url := '%s/facebook-ads-sync-all',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

  -- 7. Checkout Abandoned Scanner — every 15 minutes
  PERFORM cron.schedule(
    'checkout-abandoned-scanner',
    '*/15 * * * *',
    format($$
      SELECT net.http_post(
        url := '%s/checkout-abandoned-scanner',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

  -- 8. Weekly Report — every Monday at 12:00 UTC (09:00 BRT)
  PERFORM cron.schedule(
    'wa-weekly-report',
    '0 12 * * 1',
    format($$
      SELECT net.http_post(
        url := '%s/wa-weekly-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('target_jid', '120363409438175766@g.us')
      );
    $$, base_url)
  ) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;

END;
$$;

-- Table to track cron job status visible in the app
CREATE TABLE IF NOT EXISTS imphq_cron_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key     text UNIQUE NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text, -- 'success' | 'error' | 'running'
  last_error  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Seed the 8 jobs
INSERT INTO imphq_cron_jobs (job_key, is_enabled) VALUES
  ('daily-briefing-wa',          true),
  ('payment-recovery',           true),
  ('hot-lead-responder',         true),
  ('wa-health-monitor',          true),
  ('wa-cold-lead-reactivator',   true),
  ('facebook-ads-sync-all',      true),
  ('checkout-abandoned-scanner', true),
  ('wa-weekly-report',           true)
ON CONFLICT (job_key) DO NOTHING;

-- RLS: allow authenticated users to read
ALTER TABLE imphq_cron_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cron_jobs_read" ON imphq_cron_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "cron_jobs_update" ON imphq_cron_jobs FOR UPDATE TO authenticated USING (true);

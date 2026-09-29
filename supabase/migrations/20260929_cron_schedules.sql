-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Table to track cron job status visible in the app
CREATE TABLE IF NOT EXISTS imphq_cron_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key     text UNIQUE NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text CHECK (last_status IN ('success','error','running')),
  last_error  text,
  run_count   integer NOT NULL DEFAULT 0,
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

-- RLS: allow authenticated users to read and update
ALTER TABLE imphq_cron_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='imphq_cron_jobs' AND policyname='cron_jobs_read') THEN
    CREATE POLICY cron_jobs_read ON imphq_cron_jobs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='imphq_cron_jobs' AND policyname='cron_jobs_update') THEN
    CREATE POLICY cron_jobs_update ON imphq_cron_jobs FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

-- Helper function to execute cron jobs, respect is_enabled toggle, and update status in imphq_cron_jobs
CREATE OR REPLACE FUNCTION run_cron_job(p_job_key text, p_function_name text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_url text := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1';
  svc_key  text := current_setting('app.settings.service_role_key', true);
  v_enabled boolean;
BEGIN
  -- Check if job is enabled in table
  SELECT is_enabled INTO v_enabled FROM imphq_cron_jobs WHERE job_key = p_job_key;
  IF v_enabled IS FALSE THEN
    RETURN;
  END IF;

  -- Record running state
  UPDATE imphq_cron_jobs
  SET last_run_at = now(),
      last_status = 'running',
      run_count = run_count + 1
  WHERE job_key = p_job_key;

  -- Fire HTTP request to Edge Function via pg_net
  PERFORM net.http_post(
    url := base_url || '/' || p_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := p_body
  );

  -- Record success
  UPDATE imphq_cron_jobs
  SET last_status = 'success',
      last_error = NULL
  WHERE job_key = p_job_key;
EXCEPTION WHEN OTHERS THEN
  UPDATE imphq_cron_jobs
  SET last_status = 'error',
      last_error = SQLERRM
  WHERE job_key = p_job_key;
END;
$$;

-- Register schedules with pg_cron
DO $$
BEGIN
  -- 1. Daily Briefing WA — 09:00 BRT = 12:00 UTC
  PERFORM cron.schedule(
    'daily-briefing-wa',
    '0 12 * * *',
    'SELECT run_cron_job(''daily-briefing-wa'', ''daily-briefing-wa'')'
  );

  -- 2. Payment Recovery — every 15 min
  PERFORM cron.schedule(
    'payment-recovery',
    '*/15 * * * *',
    'SELECT run_cron_job(''payment-recovery'', ''payment-recovery'')'
  );

  -- 3. Hot Lead Responder — every 30 min
  PERFORM cron.schedule(
    'hot-lead-responder',
    '*/30 * * * *',
    'SELECT run_cron_job(''hot-lead-responder'', ''hot-lead-responder'')'
  );

  -- 4. WA Health Monitor — every 10 min
  PERFORM cron.schedule(
    'wa-health-monitor',
    '*/10 * * * *',
    'SELECT run_cron_job(''wa-health-monitor'', ''wa-health-monitor'')'
  );

  -- 5. Cold Lead Reactivator — 07:00 BRT = 10:00 UTC
  PERFORM cron.schedule(
    'wa-cold-lead-reactivator',
    '0 10 * * *',
    'SELECT run_cron_job(''wa-cold-lead-reactivator'', ''wa-cold-lead-reactivator'')'
  );

  -- 6. Meta Ads Sync — every 6h
  PERFORM cron.schedule(
    'facebook-ads-sync-all',
    '0 */6 * * *',
    'SELECT run_cron_job(''facebook-ads-sync-all'', ''facebook-ads-sync-all'')'
  );

  -- 7. Checkout Abandoned Scanner — every 15 min
  PERFORM cron.schedule(
    'checkout-abandoned-scanner',
    '*/15 * * * *',
    'SELECT run_cron_job(''checkout-abandoned-scanner'', ''checkout-abandoned-scanner'')'
  );

  -- 8. Weekly Report — Monday 09:00 BRT = 12:00 UTC
  PERFORM cron.schedule(
    'wa-weekly-report',
    '0 12 * * 1',
    'SELECT run_cron_job(''wa-weekly-report'', ''wa-weekly-report'', ''{"target_jid": "120363409438175766@g.us"}''::jsonb)'
  );
END;
$$;

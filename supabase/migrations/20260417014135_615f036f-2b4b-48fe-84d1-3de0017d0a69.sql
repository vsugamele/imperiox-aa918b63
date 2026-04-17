-- Garantir extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover job antigo se existir
DO $$ BEGIN
  PERFORM cron.unschedule('daily-briefing-job');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Agendar diariamente às 10:00 UTC (07:00 BRT)
SELECT cron.schedule(
  'daily-briefing-job',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url:='https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/daily-briefing?force=true',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
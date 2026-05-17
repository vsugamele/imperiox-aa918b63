-- Garante extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('hot-lead-responder-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'hot-lead-responder-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/hot-lead-responder',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
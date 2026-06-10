-- Cron: wa-behavioral-triggers every 5 minutes
-- Checks stalled leads and sends automatic follow-ups in active flow executions
SELECT cron.schedule(
  'wa-behavioral-triggers',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/wa-behavioral-triggers',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Cron: ig-sequence-tick every 5 minutes
-- Processes pending Instagram sequence enrollments and sends next step messages
SELECT cron.schedule(
  'ig-sequence-tick',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/ig-sequence-tick',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

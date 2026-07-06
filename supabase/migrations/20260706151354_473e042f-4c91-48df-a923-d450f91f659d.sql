
-- wa-ai-resume-check: */3 -> */25
SELECT cron.unschedule('wa-ai-resume-check');
SELECT cron.schedule('wa-ai-resume-check','*/25 * * * *', $$
  SELECT net.http_post(
    url:='https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/wa-ai-resume-check',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body:='{}'::jsonb
  );
$$);

-- wa-ai-pending-flush: */5 -> */10
SELECT cron.unschedule('wa-ai-pending-flush');
SELECT cron.schedule('wa-ai-pending-flush','*/10 * * * *', $$
  SELECT net.http_post(
    url:='https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/wa-ai-pending-flush',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body:='{}'::jsonb
  );
$$);

-- openflow-resume-scheduler: */2 -> */5
SELECT cron.unschedule('openflow-resume-scheduler');
SELECT cron.schedule('openflow-resume-scheduler','*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/openflow-resume',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- imperius-scout-15min: */15 -> 0 * * * *
SELECT cron.unschedule('imperius-scout-15min');
SELECT cron.schedule('imperius-scout-15min','0 * * * *', $$
  select net.http_post(
    url:='https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperius-scout',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body:='{"source":"cron"}'::jsonb
  );
$$);

-- seed-engine-tick: */2 -> */5
SELECT cron.unschedule('seed-engine-tick');
SELECT cron.schedule('seed-engine-tick','*/5 * * * *', $$
  SELECT net.http_post(
    url:='https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/seed-engine-tick',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
$$);

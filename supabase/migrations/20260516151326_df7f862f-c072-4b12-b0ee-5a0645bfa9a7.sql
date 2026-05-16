DO $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0';
  base_url text := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1';
BEGIN
  -- remove jobs antigos com mesmo nome se existirem
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
    'ads-ai-optimizer','wa-ai-triage-batch','nurture-auto-segment','content-calendar-ai','imperius-daily-digest'
  );

  PERFORM cron.schedule('ads-ai-optimizer','0 */8 * * *',
    format($f$select net.http_post(url:='%s/ads-ai-optimizer', headers:=jsonb_build_object('Content-Type','application/json','apikey','%s'), body:='{}'::jsonb)$f$, base_url, anon_key));

  PERFORM cron.schedule('nurture-auto-segment','0 9 * * *',
    format($f$select net.http_post(url:='%s/nurture-auto-segment', headers:=jsonb_build_object('Content-Type','application/json','apikey','%s'), body:='{}'::jsonb)$f$, base_url, anon_key));

  PERFORM cron.schedule('content-calendar-ai','0 6 * * 1',
    format($f$select net.http_post(url:='%s/content-calendar-ai', headers:=jsonb_build_object('Content-Type','application/json','apikey','%s'), body:='{}'::jsonb)$f$, base_url, anon_key));

  PERFORM cron.schedule('imperius-daily-digest','0 8 * * *',
    format($f$select net.http_post(url:='%s/imperius-daily-digest', headers:=jsonb_build_object('Content-Type','application/json','apikey','%s'), body:='{}'::jsonb)$f$, base_url, anon_key));
END $$;
DO $$
DECLARE
  base_url text := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1';
  service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  IF service_key IS NULL THEN
    RAISE NOTICE 'service_role_key not in vault; skipping cron update';
    RETURN;
  END IF;
  PERFORM cron.unschedule('content-calendar-ai');
  PERFORM cron.schedule('content-calendar-ai','0 6 * * 1',
    format($f$select net.http_post(url:='%s/content-calendar-ai', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body:='{}'::jsonb)$f$, base_url, service_key));
END $$;
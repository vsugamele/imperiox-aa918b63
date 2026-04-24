-- Habilita extensões necessárias (idempotente)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior se existir (idempotente)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-stories-cron-08brt') then
    perform cron.unschedule('daily-stories-cron-08brt');
  end if;
end $$;

-- Agenda 11:00 UTC = 08:00 BRT diariamente
select cron.schedule(
  'daily-stories-cron-08brt',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/daily-stories-cron',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body := jsonb_build_object('triggered_at', now()::text)
  ) as request_id;
  $$
);
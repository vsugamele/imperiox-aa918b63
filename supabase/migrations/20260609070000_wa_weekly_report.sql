-- Weekly report: cron para relatório semanal automático

-- Coluna para contato do dono do projeto (para envio do relatório)
ALTER TABLE public.imphq_projects
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Cron: toda segunda-feira às 08:00 (UTC) — relatório da semana anterior
SELECT cron.schedule(
  'wa-weekly-report-monday',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/wa-weekly-report',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

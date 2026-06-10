-- Hot lead closer: colunas de rastreio + cron wa-closer-trigger

-- ── Colunas em imphq_leads ──────────────────────────────────────────────────
-- closer_triggered_at: quando o lead cruzou o threshold de score (setado pelo lead-score-updater)
-- closer_message_sent_at: quando a mensagem de fechamento foi enviada (evita duplicatas)
ALTER TABLE public.imphq_leads
  ADD COLUMN IF NOT EXISTS closer_triggered_at    timestamptz,
  ADD COLUMN IF NOT EXISTS closer_message_sent_at timestamptz;

-- Índice para a query principal do wa-closer-trigger
CREATE INDEX IF NOT EXISTS idx_leads_closer_trigger
  ON public.imphq_leads (closer_triggered_at, closer_message_sent_at)
  WHERE closer_triggered_at IS NOT NULL AND closer_message_sent_at IS NULL;

-- ── Cron: wa-closer-trigger a cada hora ────────────────────────────────────
SELECT cron.schedule(
  'wa-closer-trigger-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/wa-closer-trigger',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

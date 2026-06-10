-- wa-reengagement: reativação automática de leads silenciosos
-- 1. Coluna reengagement_sent_at na tabela de conversas WA
-- 2. Coluna reengagement_sent_at na tabela de conversas IG (parity)
-- 3. Cron diário às 9h

-- ── Colunas ────────────────────────────────────────────────────────────────
ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS reengagement_sent_at timestamptz;

ALTER TABLE public.imphq_ig_conversations
  ADD COLUMN IF NOT EXISTS reengagement_sent_at timestamptz;

-- Índice para a query principal: leads silenciosos ordenados por data
CREATE INDEX IF NOT EXISTS idx_wa_conversations_reeng
  ON public.imphq_wa_conversations (project_id, ia_ativa, last_message_at)
  WHERE ia_ativa = true;

-- ── Cron: wa-reengagement diário às 9h ────────────────────────────────────
SELECT cron.schedule(
  'wa-reengagement-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/wa-reengagement',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

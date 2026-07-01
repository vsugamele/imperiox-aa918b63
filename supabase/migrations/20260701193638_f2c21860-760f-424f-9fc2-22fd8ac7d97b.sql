
-- imphq_ig_trigger_executions: campos de retry/idempotência
ALTER TABLE public.imphq_ig_trigger_executions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_trigger_exec_idempotency
  ON public.imphq_ig_trigger_executions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ig_trigger_exec_retry
  ON public.imphq_ig_trigger_executions(next_retry_at)
  WHERE status = 'retrying';

-- imphq_ig_comment_triggers: regras avançadas
ALTER TABLE public.imphq_ig_comment_triggers
  ADD COLUMN IF NOT EXISTS cooldown_hours INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_cap INTEGER,
  ADD COLUMN IF NOT EXISTS regex_pattern TEXT,
  ADD COLUMN IF NOT EXISTS negative_keywords TEXT[],
  ADD COLUMN IF NOT EXISTS media_type_filter TEXT;

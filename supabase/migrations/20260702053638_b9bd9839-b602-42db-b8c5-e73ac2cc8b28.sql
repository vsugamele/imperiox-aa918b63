
ALTER TABLE public.imphq_ig_trigger_executions
  ADD COLUMN IF NOT EXISTS author_key TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ig_trigger_exec_trigger_author_time
  ON public.imphq_ig_trigger_executions(trigger_id, author_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ig_trigger_exec_status_time
  ON public.imphq_ig_trigger_executions(status, created_at DESC);

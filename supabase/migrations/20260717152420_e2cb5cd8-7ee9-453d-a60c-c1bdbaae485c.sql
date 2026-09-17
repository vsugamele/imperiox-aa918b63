-- Retry inteligente + Dead-letter para OpenFlow
ALTER TABLE public.imphq_flow_executions
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_flow_exec_retry ON public.imphq_flow_executions (status, next_run_at)
  WHERE status IN ('running','retrying','waiting');

-- Dead-letter queue
CREATE TABLE IF NOT EXISTS public.imphq_flow_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,
  automacao_id UUID NOT NULL,
  project_id UUID NOT NULL,
  lead_id UUID,
  current_step INTEGER NOT NULL DEFAULT 0,
  step_snapshot JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_kind TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  step_results JSONB DEFAULT '[]'::jsonb,
  reprocessed_at TIMESTAMPTZ,
  reprocess_execution_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_dead_letter TO authenticated;
GRANT ALL ON public.imphq_flow_dead_letter TO service_role;

ALTER TABLE public.imphq_flow_dead_letter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_dead_letter_authenticated_all"
  ON public.imphq_flow_dead_letter
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_flow_dead_letter_project ON public.imphq_flow_dead_letter (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_dead_letter_automacao ON public.imphq_flow_dead_letter (automacao_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_flow_dead_letter;
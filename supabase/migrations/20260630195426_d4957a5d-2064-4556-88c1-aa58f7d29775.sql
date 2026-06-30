CREATE TABLE IF NOT EXISTS public.imphq_ig_trigger_executions (
  comment_id TEXT PRIMARY KEY,
  trigger_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'comment',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.imphq_ig_trigger_executions TO service_role;
ALTER TABLE public.imphq_ig_trigger_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages ig trigger executions"
  ON public.imphq_ig_trigger_executions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
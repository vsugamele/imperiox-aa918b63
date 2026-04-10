
CREATE TABLE public.imphq_flow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automacao_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  lead_id TEXT,
  trigger_tipo TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  step_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_run_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can view flow executions"
  ON public.imphq_flow_executions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imphq_projects p
      WHERE p.id::text = project_id AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_imphq_flow_executions_updated_at
  BEFORE UPDATE ON public.imphq_flow_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_imphq_flow_executions_project ON public.imphq_flow_executions(project_id);
CREATE INDEX idx_imphq_flow_executions_status ON public.imphq_flow_executions(status);
CREATE INDEX idx_imphq_flow_executions_next_run ON public.imphq_flow_executions(next_run_at) WHERE next_run_at IS NOT NULL;

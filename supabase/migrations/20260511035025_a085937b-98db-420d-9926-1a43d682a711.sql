
CREATE TABLE public.imphq_studio_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  projeto_id TEXT,
  name TEXT NOT NULL,
  template_key TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_studio_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wf_select_own" ON public.imphq_studio_workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wf_insert_own" ON public.imphq_studio_workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wf_update_own" ON public.imphq_studio_workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "wf_delete_own" ON public.imphq_studio_workflows FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_wf_updated_at BEFORE UPDATE ON public.imphq_studio_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.imphq_studio_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.imphq_studio_workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  current_step INT NOT NULL DEFAULT 0,
  step_outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  generation_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_studio_workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wfrun_select_own" ON public.imphq_studio_workflow_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wfrun_insert_own" ON public.imphq_studio_workflow_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wfrun_update_own" ON public.imphq_studio_workflow_runs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "wfrun_delete_own" ON public.imphq_studio_workflow_runs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_wfrun_updated_at BEFORE UPDATE ON public.imphq_studio_workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wf_user ON public.imphq_studio_workflows(user_id);
CREATE INDEX idx_wfrun_user ON public.imphq_studio_workflow_runs(user_id);
CREATE INDEX idx_wfrun_workflow ON public.imphq_studio_workflow_runs(workflow_id);

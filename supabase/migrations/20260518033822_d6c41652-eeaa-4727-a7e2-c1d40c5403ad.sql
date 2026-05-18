CREATE TABLE public.imphq_ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id TEXT,
  action TEXT NOT NULL,
  model TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_jobs_user_status ON public.imphq_ai_jobs(user_id, status, created_at DESC);
CREATE INDEX idx_ai_jobs_project ON public.imphq_ai_jobs(project_id, created_at DESC);

ALTER TABLE public.imphq_ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai jobs" ON public.imphq_ai_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own ai jobs" ON public.imphq_ai_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
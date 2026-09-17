ALTER TABLE public.imphq_studio_workflows
  ADD COLUMN IF NOT EXISTS run_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS run_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS run_finished_at TIMESTAMPTZ;

ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_studio_workflows;
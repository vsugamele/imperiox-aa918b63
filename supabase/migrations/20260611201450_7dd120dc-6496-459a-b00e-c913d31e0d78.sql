
CREATE TABLE IF NOT EXISTS public.imphq_autopilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  current_step integer NOT NULL DEFAULT 0,
  total_steps integer NOT NULL DEFAULT 0,
  input jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  scraped_context text,
  assets jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_autopilot_runs TO authenticated;
GRANT ALL ON public.imphq_autopilot_runs TO service_role;

ALTER TABLE public.imphq_autopilot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own autopilot runs"
  ON public.imphq_autopilot_runs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_autopilot_runs_project ON public.imphq_autopilot_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_user ON public.imphq_autopilot_runs(user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_autopilot_runs_updated ON public.imphq_autopilot_runs;
CREATE TRIGGER trg_autopilot_runs_updated
  BEFORE UPDATE ON public.imphq_autopilot_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

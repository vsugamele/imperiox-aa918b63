
CREATE TABLE public.imphq_expert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  content_id text NOT NULL,
  week text,
  day text,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_expert_logs_project ON public.imphq_expert_logs(project_id);
CREATE INDEX idx_expert_logs_content ON public.imphq_expert_logs(project_id, content_id);

ALTER TABLE public.imphq_expert_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to expert logs" ON public.imphq_expert_logs
  FOR ALL USING (true) WITH CHECK (true);

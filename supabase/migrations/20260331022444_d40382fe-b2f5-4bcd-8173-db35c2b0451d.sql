
CREATE TABLE public.imphq_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  member_id TEXT,
  project_id UUID,
  category TEXT NOT NULL DEFAULT 'geral',
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.imphq_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their processes"
  ON public.imphq_processes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

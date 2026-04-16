CREATE TABLE public.imphq_daily_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  project_id TEXT,
  briefing_text TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_imphq_daily_briefings_unique
  ON public.imphq_daily_briefings (briefing_date, COALESCE(project_id, '__global__'));

CREATE INDEX idx_imphq_daily_briefings_date
  ON public.imphq_daily_briefings (briefing_date DESC);

ALTER TABLE public.imphq_daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read briefings"
  ON public.imphq_daily_briefings
  FOR SELECT
  TO authenticated
  USING (true);
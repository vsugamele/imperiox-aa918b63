
CREATE TABLE IF NOT EXISTS public.imphq_funnel_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  lead_id TEXT,
  step TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  utm_id TEXT,
  xcod TEXT,
  creative_id TEXT,
  fbclid TEXT,
  referrer TEXT,
  user_agent TEXT,
  page_url TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_project_created ON public.imphq_funnel_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON public.imphq_funnel_events (session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_step_created ON public.imphq_funnel_events (project_id, step, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_creative ON public.imphq_funnel_events (project_id, creative_id) WHERE creative_id IS NOT NULL;

ALTER TABLE public.imphq_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read funnel events"
  ON public.imphq_funnel_events FOR SELECT
  TO authenticated
  USING (true);

-- Inserts vão acontecer via Edge Function usando service role (bypass RLS).
-- Bloqueamos insert/update/delete pelo cliente.

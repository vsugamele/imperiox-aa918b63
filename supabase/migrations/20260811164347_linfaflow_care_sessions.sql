CREATE TABLE IF NOT EXISTS public.imphq_linfaflow_care_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  project_id TEXT DEFAULT 'lipo',
  automacao_id TEXT,
  lead_id TEXT,
  name TEXT,
  contact TEXT,
  intake JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  script_step INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'intake',
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT DEFAULT 'linfaflow-care',
  checkout_url TEXT,
  checkout_clicked_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.imphq_linfaflow_care_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.imphq_linfaflow_care_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  sender TEXT,
  script_step INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linfaflow_care_sessions_status_step
  ON public.imphq_linfaflow_care_sessions(status, script_step, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_linfaflow_care_sessions_token
  ON public.imphq_linfaflow_care_sessions(public_token);

CREATE INDEX IF NOT EXISTS idx_linfaflow_care_events_session
  ON public.imphq_linfaflow_care_events(session_id, created_at);

ALTER TABLE public.imphq_linfaflow_care_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_linfaflow_care_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_linfaflow_care_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_linfaflow_care_events TO service_role;

CREATE POLICY "Authenticated users can read LinfaFlow care sessions"
  ON public.imphq_linfaflow_care_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read LinfaFlow care events"
  ON public.imphq_linfaflow_care_events
  FOR SELECT
  TO authenticated
  USING (true);

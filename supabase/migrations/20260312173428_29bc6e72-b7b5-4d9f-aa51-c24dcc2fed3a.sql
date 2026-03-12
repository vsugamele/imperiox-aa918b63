CREATE TABLE public.imphq_events (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  event_name TEXT NOT NULL DEFAULT 'PageView',
  event_data JSONB DEFAULT '{}',
  page_url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  project_id TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert on imphq_events"
  ON public.imphq_events FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated read on imphq_events"
  ON public.imphq_events FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_imphq_events_visitor ON public.imphq_events(visitor_id);
CREATE INDEX idx_imphq_events_session ON public.imphq_events(session_id);
CREATE INDEX idx_imphq_events_name ON public.imphq_events(event_name);
CREATE INDEX idx_imphq_events_created ON public.imphq_events(created_at DESC);
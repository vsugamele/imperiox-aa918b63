
-- 1. Commands table (command bus queue)
CREATE TABLE public.wa_hub_iso_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  session_key TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Sessions table (session state)
CREATE TABLE public.wa_hub_iso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  session_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, session_key)
);

-- 3. Events table (event log)
CREATE TABLE public.wa_hub_iso_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  session_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_wa_hub_commands_status ON public.wa_hub_iso_commands (status, created_at);
CREATE INDEX idx_wa_hub_commands_session ON public.wa_hub_iso_commands (tenant_id, session_key);
CREATE INDEX idx_wa_hub_events_session ON public.wa_hub_iso_events (tenant_id, session_key, created_at DESC);
CREATE INDEX idx_wa_hub_sessions_lookup ON public.wa_hub_iso_sessions (tenant_id, session_key);

-- Auto-update updated_at
CREATE TRIGGER wa_hub_commands_updated_at
  BEFORE UPDATE ON public.wa_hub_iso_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER wa_hub_sessions_updated_at
  BEFORE UPDATE ON public.wa_hub_iso_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.wa_hub_iso_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_hub_iso_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_hub_iso_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read commands" ON public.wa_hub_iso_commands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert commands" ON public.wa_hub_iso_commands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read sessions" ON public.wa_hub_iso_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read events" ON public.wa_hub_iso_events FOR SELECT TO authenticated USING (true);

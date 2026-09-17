
ALTER TABLE public.imphq_flow_blueprints
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.imphq_flow_node_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES public.imphq_flow_blueprints(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  entered INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  dropped INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, node_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_node_stats TO authenticated;
GRANT ALL ON public.imphq_flow_node_stats TO service_role;
ALTER TABLE public.imphq_flow_node_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage flow_node_stats" ON public.imphq_flow_node_stats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.imphq_flow_runtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES public.imphq_flow_blueprints(id) ON DELETE CASCADE,
  lead_id TEXT,
  conversation_id UUID,
  node_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- entered | completed | dropped | replied
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_runtime_events TO authenticated;
GRANT ALL ON public.imphq_flow_runtime_events TO service_role;
ALTER TABLE public.imphq_flow_runtime_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage flow_runtime_events" ON public.imphq_flow_runtime_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_flow_runtime_events_bp_node ON public.imphq_flow_runtime_events(blueprint_id, node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_runtime_events_lead ON public.imphq_flow_runtime_events(lead_id, created_at DESC);

-- RPC para incrementar contadores atomicamente
CREATE OR REPLACE FUNCTION public.increment_flow_node_stat(
  p_blueprint_id UUID,
  p_node_id TEXT,
  p_field TEXT,
  p_delta INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.imphq_flow_node_stats (blueprint_id, node_id, entered, completed, dropped, active, updated_at)
  VALUES (
    p_blueprint_id, p_node_id,
    CASE WHEN p_field = 'entered' THEN p_delta ELSE 0 END,
    CASE WHEN p_field = 'completed' THEN p_delta ELSE 0 END,
    CASE WHEN p_field = 'dropped' THEN p_delta ELSE 0 END,
    CASE WHEN p_field = 'active' THEN p_delta ELSE 0 END,
    now()
  )
  ON CONFLICT (blueprint_id, node_id) DO UPDATE SET
    entered = imphq_flow_node_stats.entered + CASE WHEN p_field = 'entered' THEN p_delta ELSE 0 END,
    completed = imphq_flow_node_stats.completed + CASE WHEN p_field = 'completed' THEN p_delta ELSE 0 END,
    dropped = imphq_flow_node_stats.dropped + CASE WHEN p_field = 'dropped' THEN p_delta ELSE 0 END,
    active = GREATEST(0, imphq_flow_node_stats.active + CASE WHEN p_field = 'active' THEN p_delta ELSE 0 END),
    updated_at = now();
END;
$$;

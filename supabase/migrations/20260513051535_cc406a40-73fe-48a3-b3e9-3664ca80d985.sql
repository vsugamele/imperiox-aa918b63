
CREATE TABLE IF NOT EXISTS public.imphq_ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','executed','reverted','failed')),
  confidence NUMERIC(4,3) DEFAULT 0.5,
  title TEXT NOT NULL,
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  revert_payload JSONB,
  result JSONB,
  projeto_id TEXT,
  source TEXT DEFAULT 'imperius-scout',
  auto_executed BOOLEAN DEFAULT false,
  created_by UUID,
  approved_by UUID,
  executed_at TIMESTAMPTZ,
  reverted_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON public.imphq_ai_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_risk ON public.imphq_ai_actions(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_actions_projeto ON public.imphq_ai_actions(projeto_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created ON public.imphq_ai_actions(created_at DESC);

ALTER TABLE public.imphq_ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ai_actions"
  ON public.imphq_ai_actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert ai_actions"
  ON public.imphq_ai_actions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update ai_actions"
  ON public.imphq_ai_actions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service role full access ai_actions"
  ON public.imphq_ai_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ai_actions_updated_at
  BEFORE UPDATE ON public.imphq_ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

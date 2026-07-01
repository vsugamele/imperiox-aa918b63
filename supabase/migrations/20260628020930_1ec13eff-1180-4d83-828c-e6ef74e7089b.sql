
-- Frente 1: Auto-execução do Auditor
CREATE TABLE public.imphq_funnel_audit_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text,
  funil_id uuid,
  audit_run_id uuid,
  action_type text NOT NULL,
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'pending',
  executed_at timestamptz,
  executed_result jsonb,
  rejected_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_risk CHECK (risk_level IN ('low','medium','high')),
  CONSTRAINT chk_status CHECK (status IN ('pending','approved','executed','rejected','failed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_funnel_audit_actions TO authenticated;
GRANT ALL ON public.imphq_funnel_audit_actions TO service_role;
ALTER TABLE public.imphq_funnel_audit_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read audit actions" ON public.imphq_funnel_audit_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage audit actions" ON public.imphq_funnel_audit_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_funnel_audit_actions_status ON public.imphq_funnel_audit_actions(status, projeto_id);
CREATE INDEX idx_funnel_audit_actions_funil ON public.imphq_funnel_audit_actions(funil_id);

-- Frente 2: Orquestrador de Lançamento
CREATE TABLE public.imphq_launch_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text NOT NULL,
  funil_id uuid,
  peca_tipo text NOT NULL,
  peca_ref_id text,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_min integer DEFAULT 60,
  depends_on uuid[] DEFAULT ARRAY[]::uuid[],
  status text NOT NULL DEFAULT 'pending',
  is_milestone boolean DEFAULT false,
  owner uuid,
  color text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_timeline_status CHECK (status IN ('pending','in_progress','done','late','cancelled'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_launch_timeline TO authenticated;
GRANT ALL ON public.imphq_launch_timeline TO service_role;
ALTER TABLE public.imphq_launch_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read timeline" ON public.imphq_launch_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage timeline" ON public.imphq_launch_timeline FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_launch_timeline_projeto ON public.imphq_launch_timeline(projeto_id, scheduled_at);
CREATE INDEX idx_launch_timeline_funil ON public.imphq_launch_timeline(funil_id);

-- Frente 3: Funnel Brain
CREATE TABLE public.imphq_funnel_brain_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text NOT NULL,
  funil_id uuid,
  node_id text,
  produto_id text,
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  reasoning text,
  suggested_action jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  executed_at timestamptz,
  snoozed_until timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_brain_severity CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT chk_brain_status CHECK (status IN ('active','executed','snoozed','dismissed','expired'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_funnel_brain_signals TO authenticated;
GRANT ALL ON public.imphq_funnel_brain_signals TO service_role;
ALTER TABLE public.imphq_funnel_brain_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read brain signals" ON public.imphq_funnel_brain_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage brain signals" ON public.imphq_funnel_brain_signals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_brain_signals_active ON public.imphq_funnel_brain_signals(status, severity, projeto_id);
CREATE INDEX idx_brain_signals_funil ON public.imphq_funnel_brain_signals(funil_id, node_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_funnel_audit_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_funnel_brain_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_launch_timeline;

-- updated_at triggers (reusa função existente)
CREATE TRIGGER trg_audit_actions_updated BEFORE UPDATE ON public.imphq_funnel_audit_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_timeline_updated BEFORE UPDATE ON public.imphq_launch_timeline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_brain_signals_updated BEFORE UPDATE ON public.imphq_funnel_brain_signals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

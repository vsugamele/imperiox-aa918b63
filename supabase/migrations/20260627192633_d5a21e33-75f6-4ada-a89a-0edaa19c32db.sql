ALTER TABLE public.imphq_wa_project_rules
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS pending_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID;

CREATE INDEX IF NOT EXISTS idx_wa_project_rules_status
  ON public.imphq_wa_project_rules(project_id, status);

CREATE TABLE IF NOT EXISTS public.imphq_alert_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_key TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, alert_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_alert_dismissals TO authenticated;
GRANT ALL ON public.imphq_alert_dismissals TO service_role;

ALTER TABLE public.imphq_alert_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissals"
  ON public.imphq_alert_dismissals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
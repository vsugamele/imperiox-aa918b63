-- ── ESCALATION SEMÂNTICA ──
ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalation_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_confidence numeric;

ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS auto_escalation_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_drift_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_scoring_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_drift_at timestamptz,
  ADD COLUMN IF NOT EXISTS drift_score numeric,
  ADD COLUMN IF NOT EXISTS drift_history jsonb DEFAULT '[]'::jsonb;

-- ── CONVERSATION QUALITY SCORING ──
CREATE TABLE IF NOT EXISTS public.imphq_wa_conversation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.imphq_wa_conversations(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  score numeric NOT NULL,
  outcome text NOT NULL,
  postmortem text,
  what_worked text[],
  what_failed text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  scored_at timestamptz DEFAULT now(),
  UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_scores_project_score
  ON public.imphq_wa_conversation_scores (project_id, score, scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_scores_outcome
  ON public.imphq_wa_conversation_scores (project_id, outcome, scored_at DESC);

ALTER TABLE public.imphq_wa_conversation_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_scores_select_authenticated" ON public.imphq_wa_conversation_scores;
CREATE POLICY "conv_scores_select_authenticated"
  ON public.imphq_wa_conversation_scores FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "conv_scores_service_role_all" ON public.imphq_wa_conversation_scores;
CREATE POLICY "conv_scores_service_role_all"
  ON public.imphq_wa_conversation_scores FOR ALL
  TO service_role USING (true) WITH CHECK (true);

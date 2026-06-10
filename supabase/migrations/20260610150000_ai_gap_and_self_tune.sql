-- Gap detection: marca msgs IA já analisadas + score de qualidade (0-1)
ALTER TABLE public.imphq_wa_messages
  ADD COLUMN IF NOT EXISTS gap_analyzed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gap_score numeric;

CREATE INDEX IF NOT EXISTS idx_wa_msgs_gap_pending
  ON public.imphq_wa_messages (gap_analyzed, created_at)
  WHERE gap_analyzed = false AND direction = 'outgoing';

-- Self-prompt-tuning: análise semanal de prompt baseado em conversões
ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS auto_tune_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_tune_apply boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_tune_at timestamptz,
  ADD COLUMN IF NOT EXISTS tune_history jsonb DEFAULT '[]'::jsonb;

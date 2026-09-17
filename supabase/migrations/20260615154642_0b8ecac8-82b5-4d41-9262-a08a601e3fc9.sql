
ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_debounce_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intent_tags TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS conv_status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS last_incoming_at TIMESTAMPTZ;

ALTER TABLE public.imphq_wa_messages
  ADD COLUMN IF NOT EXISTS transcription TEXT;

ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS out_of_hours_message TEXT,
  ADD COLUMN IF NOT EXISTS back_to_hours_prefix TEXT DEFAULT 'Bom dia! Voltamos ao atendimento 👋' || E'\n\n';

CREATE INDEX IF NOT EXISTS idx_wa_conv_ai_paused ON public.imphq_wa_conversations (ai_paused_until) WHERE ai_paused_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conv_last_incoming ON public.imphq_wa_conversations (last_incoming_at DESC) WHERE last_incoming_at IS NOT NULL;


ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS last_pitch_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_pitch_produto text,
  ADD COLUMN IF NOT EXISTS last_pitch_link text,
  ADD COLUMN IF NOT EXISTS pitch_followup_stage smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pitch_followup_last_at timestamptz;

ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS pitch_followup_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pitch_followup_delays_hours integer[] NOT NULL DEFAULT ARRAY[3,24,48]::integer[],
  ADD COLUMN IF NOT EXISTS pitch_followup_entry_product_id text;

CREATE INDEX IF NOT EXISTS idx_wa_conv_pitch_followup
  ON public.imphq_wa_conversations (project_id, last_pitch_at)
  WHERE last_pitch_at IS NOT NULL AND pitch_followup_stage >= 0;

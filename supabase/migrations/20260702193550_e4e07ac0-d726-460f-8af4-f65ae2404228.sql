ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS followup_state jsonb NOT NULL DEFAULT '{}'::jsonb;
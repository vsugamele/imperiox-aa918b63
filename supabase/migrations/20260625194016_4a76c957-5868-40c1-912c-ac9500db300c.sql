ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS emotional_state text,
  ADD COLUMN IF NOT EXISTS last_objection text,
  ADD COLUMN IF NOT EXISTS last_objection_at timestamptz;
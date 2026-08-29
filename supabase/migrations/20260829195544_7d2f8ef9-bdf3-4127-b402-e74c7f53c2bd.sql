ALTER TABLE public.imphq_ig_conversations
  ADD COLUMN IF NOT EXISTS ai_paused_until timestamptz;
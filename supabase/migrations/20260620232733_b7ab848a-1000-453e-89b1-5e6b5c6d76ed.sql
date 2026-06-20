
ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS handoff_summary JSONB,
  ADD COLUMN IF NOT EXISTS handoff_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_intent TEXT,
  ADD COLUMN IF NOT EXISTS intent_updated_at TIMESTAMPTZ;

ALTER TABLE public.imphq_wa_lead_memories
  ADD COLUMN IF NOT EXISTS emotional_state TEXT,
  ADD COLUMN IF NOT EXISTS last_objection TEXT;

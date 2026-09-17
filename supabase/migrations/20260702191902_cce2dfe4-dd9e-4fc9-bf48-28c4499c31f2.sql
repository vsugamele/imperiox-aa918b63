ALTER TABLE public.imphq_wa_lead_memories
  ADD COLUMN IF NOT EXISTS qualification jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS consultive_followup_enabled boolean NOT NULL DEFAULT true;
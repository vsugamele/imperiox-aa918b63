ALTER TABLE public.imphq_wa_ai_config
ADD COLUMN IF NOT EXISTS handoff_auto_resume_minutes INTEGER DEFAULT 30;
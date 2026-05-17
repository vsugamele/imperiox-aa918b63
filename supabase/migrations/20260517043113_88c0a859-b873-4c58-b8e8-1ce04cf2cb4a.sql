ALTER TABLE public.imphq_wa_conversations 
  ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_pic_updated_at TIMESTAMPTZ;

ALTER TABLE public.imphq_wa_commands 
  ADD COLUMN IF NOT EXISTS sequence JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.imphq_wa_providers 
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
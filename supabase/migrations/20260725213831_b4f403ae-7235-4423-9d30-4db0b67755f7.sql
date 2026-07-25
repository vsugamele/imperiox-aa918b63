ALTER TABLE public.imphq_wa_conversations ADD COLUMN IF NOT EXISTS color_override TEXT;
ALTER TABLE public.imphq_empresa ADD COLUMN IF NOT EXISTS status_auto_color BOOLEAN DEFAULT true;
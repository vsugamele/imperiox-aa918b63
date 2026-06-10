-- Chave Pix oficial por projeto — usada pela IA quando o lead pede Pix.
-- Se NULL, a IA nunca inventa dados de Pix e transfere para humano.
ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS pix_key text;

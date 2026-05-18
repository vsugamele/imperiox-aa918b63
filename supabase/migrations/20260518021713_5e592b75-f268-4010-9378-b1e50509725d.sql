ALTER TABLE public.imphq_prompts_salvos
  ADD COLUMN IF NOT EXISTS favorito BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plataforma TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_prompts_salvos_favorito ON public.imphq_prompts_salvos(user_id, favorito) WHERE favorito = true;
CREATE INDEX IF NOT EXISTS idx_prompts_salvos_plataforma ON public.imphq_prompts_salvos(user_id, plataforma);
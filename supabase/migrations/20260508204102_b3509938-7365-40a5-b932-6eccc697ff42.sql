
CREATE TABLE public.imphq_studio_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','processing','completed','failed')),
  output_url TEXT,
  thumbnail_url TEXT,
  external_id TEXT,
  error TEXT,
  duration_seconds NUMERIC,
  cost_usd NUMERIC,
  nicho TEXT,
  projeto_id TEXT,
  source_prompt_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_studio_generations_user ON public.imphq_studio_generations(user_id, created_at DESC);
CREATE INDEX idx_studio_generations_kind ON public.imphq_studio_generations(kind);
CREATE INDEX idx_studio_generations_status ON public.imphq_studio_generations(status);

ALTER TABLE public.imphq_studio_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own generations" ON public.imphq_studio_generations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own generations" ON public.imphq_studio_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own generations" ON public.imphq_studio_generations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own generations" ON public.imphq_studio_generations
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_studio_generations_updated_at
  BEFORE UPDATE ON public.imphq_studio_generations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

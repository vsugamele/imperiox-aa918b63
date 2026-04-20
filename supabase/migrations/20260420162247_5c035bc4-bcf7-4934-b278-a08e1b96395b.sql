-- Creative Batches (lotes de geração)
CREATE TABLE public.imphq_creative_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Batch sem nome',
  briefing JSONB NOT NULL DEFAULT '{}'::jsonb,
  referencias_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  referencias_context TEXT,
  expert_fotos TEXT[] DEFAULT ARRAY[]::TEXT[],
  angulos TEXT[] DEFAULT ARRAY[]::TEXT[],
  formato TEXT NOT NULL DEFAULT '1:1',
  total_gerado INTEGER NOT NULL DEFAULT 0,
  total_planejado INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_creative_batches_project ON public.imphq_creative_batches(project_id);
CREATE INDEX idx_creative_batches_user ON public.imphq_creative_batches(user_id);
CREATE INDEX idx_creative_batches_status ON public.imphq_creative_batches(status);

ALTER TABLE public.imphq_creative_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own creative batches"
  ON public.imphq_creative_batches FOR SELECT
  USING (auth.uid() = user_id OR public.is_imphq_admin(auth.uid()));

CREATE POLICY "Users insert own creative batches"
  ON public.imphq_creative_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own creative batches"
  ON public.imphq_creative_batches FOR UPDATE
  USING (auth.uid() = user_id OR public.is_imphq_admin(auth.uid()));

CREATE POLICY "Users delete own creative batches"
  ON public.imphq_creative_batches FOR DELETE
  USING (auth.uid() = user_id OR public.is_imphq_admin(auth.uid()));

CREATE TRIGGER trg_creative_batches_updated
  BEFORE UPDATE ON public.imphq_creative_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Creative Assets (imagens individuais)
CREATE TABLE public.imphq_creative_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.imphq_creative_batches(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  angulo TEXT NOT NULL,
  prompt_usado TEXT NOT NULL,
  headline_copy TEXT,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  formato TEXT NOT NULL DEFAULT '1:1',
  aprovado BOOLEAN NOT NULL DEFAULT false,
  favorito BOOLEAN NOT NULL DEFAULT false,
  reprovado BOOLEAN NOT NULL DEFAULT false,
  parent_asset_id UUID REFERENCES public.imphq_creative_assets(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_creative_assets_batch ON public.imphq_creative_assets(batch_id);
CREATE INDEX idx_creative_assets_project ON public.imphq_creative_assets(project_id);
CREATE INDEX idx_creative_assets_user ON public.imphq_creative_assets(user_id);
CREATE INDEX idx_creative_assets_favorito ON public.imphq_creative_assets(favorito) WHERE favorito = true;

ALTER TABLE public.imphq_creative_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own creative assets"
  ON public.imphq_creative_assets FOR SELECT
  USING (auth.uid() = user_id OR public.is_imphq_admin(auth.uid()));

CREATE POLICY "Users insert own creative assets"
  ON public.imphq_creative_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own creative assets"
  ON public.imphq_creative_assets FOR UPDATE
  USING (auth.uid() = user_id OR public.is_imphq_admin(auth.uid()));

CREATE POLICY "Users delete own creative assets"
  ON public.imphq_creative_assets FOR DELETE
  USING (auth.uid() = user_id OR public.is_imphq_admin(auth.uid()));

CREATE TRIGGER trg_creative_assets_updated
  BEFORE UPDATE ON public.imphq_creative_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Storage bucket público para imagens geradas
INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-assets', 'creative-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Creative assets are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'creative-assets');

CREATE POLICY "Authenticated users can upload creative assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'creative-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update creative assets they uploaded"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'creative-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete creative assets they uploaded"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'creative-assets' AND auth.role() = 'authenticated');
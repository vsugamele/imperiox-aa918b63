CREATE TABLE public.imphq_studio_reference_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  projeto_id TEXT,
  title TEXT,
  source_kind TEXT NOT NULL DEFAULT 'library', -- library | folder | selection
  source_folder TEXT,
  source_asset_ids TEXT[] NOT NULL DEFAULT '{}',
  source_assets JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{url, title, kind}]
  ficha JSONB, -- estilo visual, paleta, enquadramento, ritmo, copy_pattern, hook, cta, duracao
  storyboard JSONB, -- {output_type, cenas: [{n, prompt_imagem, narracao, on_screen_text, duracao}]}
  output_type TEXT, -- image | carrossel | reels | vsl | storyboard
  status TEXT NOT NULL DEFAULT 'draft', -- draft | analyzed | storyboarded | generated
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_studio_reference_models TO authenticated;
GRANT ALL ON public.imphq_studio_reference_models TO service_role;

ALTER TABLE public.imphq_studio_reference_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reference models" ON public.imphq_studio_reference_models
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_srm_user ON public.imphq_studio_reference_models(user_id, created_at DESC);
CREATE INDEX idx_srm_projeto ON public.imphq_studio_reference_models(projeto_id);

CREATE TRIGGER srm_updated_at BEFORE UPDATE ON public.imphq_studio_reference_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
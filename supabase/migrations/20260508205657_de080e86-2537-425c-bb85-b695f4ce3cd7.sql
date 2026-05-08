
-- Swipes table
CREATE TABLE public.imphq_swipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT,
  produto_id TEXT,
  title TEXT NOT NULL DEFAULT 'Sem título',
  criador TEXT,
  plataforma TEXT,
  formato TEXT,
  mecanismo TEXT,
  gatilhos TEXT[] DEFAULT '{}',
  nicho TEXT,
  tags TEXT[] DEFAULT '{}',
  rating SMALLINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  blocks JSONB NOT NULL DEFAULT '{}'::jsonb,
  reverse_engineering JSONB DEFAULT '{}'::jsonb,
  source_url TEXT,
  media_urls TEXT[] DEFAULT '{}',
  raw_text TEXT,
  source_swipe_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_imphq_swipes_user ON public.imphq_swipes(user_id);
CREATE INDEX idx_imphq_swipes_project ON public.imphq_swipes(project_id);
CREATE INDEX idx_imphq_swipes_nicho ON public.imphq_swipes(nicho);
CREATE INDEX idx_imphq_swipes_tags ON public.imphq_swipes USING GIN(tags);

ALTER TABLE public.imphq_swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swipes_select_own" ON public.imphq_swipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "swipes_insert_own" ON public.imphq_swipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "swipes_update_own" ON public.imphq_swipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "swipes_delete_own" ON public.imphq_swipes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_imphq_swipes_updated_at
  BEFORE UPDATE ON public.imphq_swipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Templates (formulas)
CREATE TABLE public.imphq_swipe_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  formula TEXT,
  skeleton JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_swipe_ids UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_imphq_swipe_templates_user ON public.imphq_swipe_templates(user_id);

ALTER TABLE public.imphq_swipe_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swipe_templates_select_own" ON public.imphq_swipe_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "swipe_templates_insert_own" ON public.imphq_swipe_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "swipe_templates_update_own" ON public.imphq_swipe_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "swipe_templates_delete_own" ON public.imphq_swipe_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_imphq_swipe_templates_updated_at
  BEFORE UPDATE ON public.imphq_swipe_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for swipe media
INSERT INTO storage.buckets (id, name, public) VALUES ('swipe-media', 'swipe-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "swipe_media_select_own" ON storage.objects FOR SELECT
  USING (bucket_id = 'swipe-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "swipe_media_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'swipe-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "swipe_media_update_own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'swipe-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "swipe_media_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'swipe-media' AND auth.uid()::text = (storage.foldername(name))[1]);

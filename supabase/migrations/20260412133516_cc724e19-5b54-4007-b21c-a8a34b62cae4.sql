
CREATE TABLE public.imphq_mi_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT REFERENCES public.imphq_projects(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('offer', 'angle', 'factory', 'opportunity')),
  item_key TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_mi_fav_unique ON public.imphq_mi_favorites(user_id, tipo, item_key, COALESCE(project_id, '__none__'));

ALTER TABLE public.imphq_mi_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites"
  ON public.imphq_mi_favorites FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

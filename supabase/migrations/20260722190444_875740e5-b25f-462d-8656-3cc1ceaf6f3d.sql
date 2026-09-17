
CREATE TABLE public.imphq_ref_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_ref_folders TO authenticated;
GRANT ALL ON public.imphq_ref_folders TO service_role;
ALTER TABLE public.imphq_ref_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own folders" ON public.imphq_ref_folders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.imphq_ref_folder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.imphq_ref_folders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumb_url text,
  titulo text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_ref_folder_items TO authenticated;
GRANT ALL ON public.imphq_ref_folder_items TO service_role;
ALTER TABLE public.imphq_ref_folder_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own folder items" ON public.imphq_ref_folder_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ref_folder_items_folder ON public.imphq_ref_folder_items(folder_id, ordem);

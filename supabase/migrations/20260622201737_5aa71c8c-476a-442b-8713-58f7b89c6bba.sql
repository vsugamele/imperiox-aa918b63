
CREATE TABLE public.imphq_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'lp',
  status text NOT NULL DEFAULT 'ativo',
  tags text[] NOT NULL DEFAULT '{}',
  thumbnail_url text,
  branding_json jsonb,
  content_md text,
  summary text,
  last_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_sites TO authenticated;
GRANT ALL ON public.imphq_sites TO service_role;
ALTER TABLE public.imphq_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage sites" ON public.imphq_sites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.imphq_project_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.imphq_sites(id) ON DELETE CASCADE,
  projeto_id text NOT NULL,
  papel text NOT NULL DEFAULT 'lp',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, projeto_id, papel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_project_sites TO authenticated;
GRANT ALL ON public.imphq_project_sites TO service_role;
ALTER TABLE public.imphq_project_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage project_sites" ON public.imphq_project_sites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_imphq_sites_user ON public.imphq_sites(user_id);
CREATE INDEX idx_imphq_project_sites_projeto ON public.imphq_project_sites(projeto_id);

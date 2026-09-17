
CREATE TABLE public.imphq_avatar_studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  nome text NOT NULL,
  descricao text,
  avatar_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  estilo_base text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_avatar_studio_projects TO authenticated;
GRANT ALL ON public.imphq_avatar_studio_projects TO service_role;
ALTER TABLE public.imphq_avatar_studio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avatar_studio_projects_all_auth" ON public.imphq_avatar_studio_projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_avatar_studio_projects_updated_at
  BEFORE UPDATE ON public.imphq_avatar_studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.imphq_avatar_studio_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_project_id uuid REFERENCES public.imphq_avatar_studio_projects(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  produto_id text,
  modo text NOT NULL,
  prompt text NOT NULL,
  media_url text,
  media_type text NOT NULL DEFAULT 'image',
  thumbnail_url text,
  library_id uuid,
  status text NOT NULL DEFAULT 'ready',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_avatar_studio_generations TO authenticated;
GRANT ALL ON public.imphq_avatar_studio_generations TO service_role;
ALTER TABLE public.imphq_avatar_studio_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avatar_studio_generations_all_auth" ON public.imphq_avatar_studio_generations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_avatar_studio_projects_project ON public.imphq_avatar_studio_projects(project_id);
CREATE INDEX idx_avatar_studio_generations_project ON public.imphq_avatar_studio_generations(project_id, created_at DESC);
CREATE INDEX idx_avatar_studio_generations_avatar ON public.imphq_avatar_studio_generations(avatar_project_id);

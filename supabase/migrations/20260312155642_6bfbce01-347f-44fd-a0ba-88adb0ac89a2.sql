CREATE TABLE public.imphq_skills (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  categoria TEXT NOT NULL DEFAULT 'Outro',
  status TEXT NOT NULL DEFAULT 'Ativo',
  icone TEXT DEFAULT 'Zap',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.imphq_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own skills"
  ON public.imphq_skills
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER update_imphq_skills_updated_at
  BEFORE UPDATE ON public.imphq_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
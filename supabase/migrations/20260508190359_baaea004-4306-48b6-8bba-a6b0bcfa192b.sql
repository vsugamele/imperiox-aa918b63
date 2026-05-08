
-- 1. Prompts library
CREATE TABLE public.imphq_studio_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nicho TEXT NOT NULL DEFAULT 'cartomantes',
  codigo TEXT,
  titulo TEXT NOT NULL,
  idade TEXT,
  genero TEXT,
  nivel TEXT NOT NULL DEFAULT 'Padrão',
  prompt_especifico TEXT NOT NULL,
  prompt_negativo TEXT,
  dicas TEXT,
  tags TEXT[] DEFAULT '{}',
  ordem INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_studio_prompts_nicho ON public.imphq_studio_prompts(nicho);
CREATE INDEX idx_studio_prompts_nivel ON public.imphq_studio_prompts(nivel);

-- 2. Pipeline steps (Avatar Plan)
CREATE TABLE public.imphq_studio_pipeline_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nicho TEXT NOT NULL DEFAULT 'cartomantes',
  fase TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'checklist',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_studio_steps_nicho_fase ON public.imphq_studio_pipeline_steps(nicho, fase, ordem);

-- 3. Playbook sections
CREATE TABLE public.imphq_studio_playbook_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nicho TEXT NOT NULL DEFAULT 'cartomantes',
  slug TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  categoria TEXT,
  titulo TEXT NOT NULL,
  conteudo_md TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nicho, slug)
);
CREATE INDEX idx_studio_playbook_nicho ON public.imphq_studio_playbook_sections(nicho, ordem);

-- 4. User personal state (favoritos, progresso)
CREATE TABLE public.imphq_studio_user_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
CREATE INDEX idx_studio_user_state_user ON public.imphq_studio_user_state(user_id, entity_type);

-- updated_at triggers
CREATE TRIGGER trg_studio_prompts_updated BEFORE UPDATE ON public.imphq_studio_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_studio_steps_updated BEFORE UPDATE ON public.imphq_studio_pipeline_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_studio_playbook_updated BEFORE UPDATE ON public.imphq_studio_playbook_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_studio_user_state_updated BEFORE UPDATE ON public.imphq_studio_user_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.imphq_studio_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_studio_pipeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_studio_playbook_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_studio_user_state ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated
CREATE POLICY "studio_prompts_read" ON public.imphq_studio_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "studio_steps_read" ON public.imphq_studio_pipeline_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "studio_playbook_read" ON public.imphq_studio_playbook_sections FOR SELECT TO authenticated USING (true);

-- Write: admins only
CREATE POLICY "studio_prompts_write" ON public.imphq_studio_prompts FOR ALL TO authenticated
  USING (public.is_imphq_admin(auth.uid())) WITH CHECK (public.is_imphq_admin(auth.uid()));
CREATE POLICY "studio_steps_write" ON public.imphq_studio_pipeline_steps FOR ALL TO authenticated
  USING (public.is_imphq_admin(auth.uid())) WITH CHECK (public.is_imphq_admin(auth.uid()));
CREATE POLICY "studio_playbook_write" ON public.imphq_studio_playbook_sections FOR ALL TO authenticated
  USING (public.is_imphq_admin(auth.uid())) WITH CHECK (public.is_imphq_admin(auth.uid()));

-- User state: own rows only
CREATE POLICY "studio_user_state_own" ON public.imphq_studio_user_state FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

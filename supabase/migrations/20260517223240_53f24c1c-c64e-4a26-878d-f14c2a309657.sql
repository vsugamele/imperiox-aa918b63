CREATE TABLE public.imphq_prompts_salvos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT,
  nome TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  campos JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_prompts_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_prompts" ON public.imphq_prompts_salvos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_prompts" ON public.imphq_prompts_salvos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_prompts" ON public.imphq_prompts_salvos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_prompts" ON public.imphq_prompts_salvos
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_prompts_salvos_user ON public.imphq_prompts_salvos(user_id, created_at DESC);
CREATE INDEX idx_prompts_salvos_project ON public.imphq_prompts_salvos(project_id) WHERE project_id IS NOT NULL;

CREATE TRIGGER trg_prompts_salvos_updated
  BEFORE UPDATE ON public.imphq_prompts_salvos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
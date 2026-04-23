-- Tabela de threads do Copilot Imperius
CREATE TABLE public.imphq_copilot_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_copilot_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias threads"
  ON public.imphq_copilot_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias threads"
  ON public.imphq_copilot_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias threads"
  ON public.imphq_copilot_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias threads"
  ON public.imphq_copilot_threads FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_copilot_threads_user ON public.imphq_copilot_threads(user_id, updated_at DESC);
CREATE INDEX idx_copilot_threads_project ON public.imphq_copilot_threads(project_id);

CREATE TRIGGER update_copilot_threads_updated_at
  BEFORE UPDATE ON public.imphq_copilot_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
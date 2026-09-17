
CREATE TABLE public.imphq_ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  nome TEXT NOT NULL,
  avatar_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  identidade TEXT DEFAULT '',
  diretrizes TEXT DEFAULT '',
  objetivo TEXT DEFAULT '',
  instrucoes_atendimento TEXT DEFAULT '',
  restricoes TEXT DEFAULT '',
  base_conhecimento TEXT DEFAULT '',
  voice_config JSONB NOT NULL DEFAULT '{"voice":"Samuel","stability":0.5,"similarity":0.5,"style":0.5,"speed":1.0}'::jsonb,
  qa_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_ai_agents TO authenticated;
GRANT ALL ON public.imphq_ai_agents TO service_role;

ALTER TABLE public.imphq_ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage agents"
ON public.imphq_ai_agents FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_imphq_ai_agents_project ON public.imphq_ai_agents(project_id);

CREATE TRIGGER trg_imphq_ai_agents_updated
BEFORE UPDATE ON public.imphq_ai_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

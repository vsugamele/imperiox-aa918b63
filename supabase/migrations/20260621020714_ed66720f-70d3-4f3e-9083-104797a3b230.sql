
-- Tabela de regras do projeto (regras comportamentais que entram SEMPRE no prompt)
CREATE TABLE IF NOT EXISTS public.imphq_wa_project_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'behavior', -- behavior | unavailable_product | qualification
  active BOOLEAN NOT NULL DEFAULT true,
  created_from_message_id UUID,
  times_applied INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_wa_project_rules TO authenticated;
GRANT ALL ON public.imphq_wa_project_rules TO service_role;

ALTER TABLE public.imphq_wa_project_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage project rules"
  ON public.imphq_wa_project_rules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_wa_project_rules_active ON public.imphq_wa_project_rules(project_id, active);

-- Enriquecimento do lead com sinais da conversa
ALTER TABLE public.imphq_leads
  ADD COLUMN IF NOT EXISTS ultimo_interesse TEXT,
  ADD COLUMN IF NOT EXISTS nivel_qualificacao TEXT, -- frio | morno | quente
  ADD COLUMN IF NOT EXISTS dor_principal TEXT,
  ADD COLUMN IF NOT EXISTS objecao_atual TEXT,
  ADD COLUMN IF NOT EXISTS qualificacao_updated_at TIMESTAMPTZ;

-- Contador de perguntas de qualificação na conversa
ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS qualification_questions_asked INTEGER NOT NULL DEFAULT 0;

-- Tipo da correção salva (na própria mensagem)
ALTER TABLE public.imphq_wa_messages
  ADD COLUMN IF NOT EXISTS feedback_correction_type TEXT; -- answer | rule | unavailable

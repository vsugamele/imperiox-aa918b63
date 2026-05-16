-- Sprint Automação/IA

-- 1. Prioridade no Imperius
ALTER TABLE public.imphq_ai_actions
  ADD COLUMN IF NOT EXISTS impact_brl NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC GENERATED ALWAYS AS (
    (COALESCE(impact_brl, 0) * COALESCE(confidence, 0.5)) /
    CASE risk_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_ai_actions_priority ON public.imphq_ai_actions(priority_score DESC) WHERE status = 'proposed';

-- 2. Biblioteca viva de objeções WhatsApp
CREATE TABLE IF NOT EXISTS public.imphq_wa_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objecao TEXT NOT NULL,
  resposta_padrao TEXT,
  contexto_produto TEXT,
  projeto_id TEXT REFERENCES public.imphq_projects(id) ON DELETE CASCADE,
  score_uso INT NOT NULL DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage objections"
  ON public.imphq_wa_objections FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wa_objections_projeto ON public.imphq_wa_objections(projeto_id);

CREATE TRIGGER trg_wa_objections_updated_at
  BEFORE UPDATE ON public.imphq_wa_objections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Triagem WhatsApp
CREATE TABLE IF NOT EXISTS public.imphq_wa_triage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID,
  conversation_id UUID,
  lead_id TEXT,
  projeto_id TEXT,
  intent TEXT,
  sentiment TEXT,
  urgency TEXT,
  fit_score INT,
  raw_message TEXT,
  ai_response TEXT,
  escalated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_triage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view triage"
  ON public.imphq_wa_triage FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service inserts triage"
  ON public.imphq_wa_triage FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wa_triage_projeto_data ON public.imphq_wa_triage(projeto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_triage_urgency ON public.imphq_wa_triage(urgency, created_at DESC) WHERE urgency = 'high';
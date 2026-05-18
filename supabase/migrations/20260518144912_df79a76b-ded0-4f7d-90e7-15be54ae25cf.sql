
-- Tabela principal de campanhas
CREATE TABLE public.imphq_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id text NOT NULL,
  nome text NOT NULL,
  slug text,
  status text NOT NULL DEFAULT 'ativa',
  produto text,
  descricao text,
  data_inicio timestamptz,
  data_fim timestamptz,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campanhas_project ON public.imphq_campanhas(project_id);
CREATE INDEX idx_campanhas_user ON public.imphq_campanhas(user_id);

ALTER TABLE public.imphq_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own campanhas" ON public.imphq_campanhas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own campanhas" ON public.imphq_campanhas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own campanhas" ON public.imphq_campanhas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own campanhas" ON public.imphq_campanhas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_campanhas_updated BEFORE UPDATE ON public.imphq_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Versionamento de formulários por campanha
CREATE TABLE public.imphq_campanha_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.imphq_campanhas(id) ON DELETE CASCADE,
  form_id uuid NOT NULL,
  user_id uuid NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  vigente_de timestamptz NOT NULL DEFAULT now(),
  vigente_ate timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campanha_forms_campanha ON public.imphq_campanha_forms(campanha_id);
CREATE INDEX idx_campanha_forms_form ON public.imphq_campanha_forms(form_id);

ALTER TABLE public.imphq_campanha_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own campanha_forms" ON public.imphq_campanha_forms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own campanha_forms" ON public.imphq_campanha_forms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own campanha_forms" ON public.imphq_campanha_forms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own campanha_forms" ON public.imphq_campanha_forms FOR DELETE USING (auth.uid() = user_id);

-- Vincula automações e leads (opcional, retrocompatível)
ALTER TABLE public.imphq_automacoes ADD COLUMN IF NOT EXISTS campanha_id uuid;
ALTER TABLE public.imphq_leads ADD COLUMN IF NOT EXISTS campanha_id uuid;

CREATE INDEX IF NOT EXISTS idx_automacoes_campanha ON public.imphq_automacoes(campanha_id);
CREATE INDEX IF NOT EXISTS idx_leads_campanha ON public.imphq_leads(campanha_id);

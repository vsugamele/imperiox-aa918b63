
CREATE TABLE public.imphq_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT,
  nome TEXT NOT NULL,
  slug TEXT,
  produto TEXT,
  funil TEXT DEFAULT 'aquisicao',
  form_type_default TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_imphq_campaigns_project ON public.imphq_campaigns(project_id);
CREATE INDEX idx_imphq_campaigns_user ON public.imphq_campaigns(user_id);
CREATE INDEX idx_imphq_campaigns_status ON public.imphq_campaigns(status);

ALTER TABLE public.imphq_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaigns"
ON public.imphq_campaigns
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_imphq_campaigns_updated_at
BEFORE UPDATE ON public.imphq_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

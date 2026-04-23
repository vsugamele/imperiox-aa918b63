CREATE TABLE public.imphq_recovery_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  canal TEXT NOT NULL,
  assunto TEXT,
  corpo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_recovery_templates_project ON public.imphq_recovery_templates(project_id);
CREATE INDEX idx_recovery_templates_tipo ON public.imphq_recovery_templates(tipo, canal);

CREATE TABLE public.imphq_recovery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  lead_id TEXT,
  venda_id TEXT,
  bucket TEXT NOT NULL,
  acao TEXT NOT NULL,
  canal TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  valor NUMERIC,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_recovery_logs_project ON public.imphq_recovery_logs(project_id);
CREATE INDEX idx_recovery_logs_lead ON public.imphq_recovery_logs(lead_id);
CREATE INDEX idx_recovery_logs_bucket ON public.imphq_recovery_logs(bucket, created_at DESC);

ALTER TABLE public.imphq_recovery_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_recovery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read recovery_templates" ON public.imphq_recovery_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth write recovery_templates" ON public.imphq_recovery_templates FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth read recovery_logs" ON public.imphq_recovery_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth write recovery_logs" ON public.imphq_recovery_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_recovery_templates_updated
  BEFORE UPDATE ON public.imphq_recovery_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
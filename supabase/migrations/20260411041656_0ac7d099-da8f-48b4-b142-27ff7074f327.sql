
-- Tabela de logs de execução do OpenFlow
CREATE TABLE public.imphq_automacao_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automacao_id TEXT NOT NULL,
  project_id TEXT,
  trigger_data JSONB DEFAULT '{}'::jsonb,
  acoes_executadas JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para consultas rápidas
CREATE INDEX idx_automacao_logs_automacao ON public.imphq_automacao_logs(automacao_id);
CREATE INDEX idx_automacao_logs_status ON public.imphq_automacao_logs(status);
CREATE INDEX idx_automacao_logs_created ON public.imphq_automacao_logs(created_at DESC);

-- RLS
ALTER TABLE public.imphq_automacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view logs"
  ON public.imphq_automacao_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert logs"
  ON public.imphq_automacao_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can insert logs"
  ON public.imphq_automacao_logs FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "Authenticated users can delete logs"
  ON public.imphq_automacao_logs FOR DELETE
  TO authenticated USING (true);

-- Tabela para armazenar Sales Paths gerados pelo Botão Imperador
CREATE TABLE IF NOT EXISTS public.imphq_sales_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'processing', -- processing | ready | failed
  health_score INTEGER, -- 0-100
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- dados coletados do projeto
  diagnostico JSONB DEFAULT '[]'::jsonb,
  oportunidades JSONB DEFAULT '[]'::jsonb,
  acoes_72h JSONB DEFAULT '[]'::jsonb,
  acoes_30d JSONB DEFAULT '[]'::jsonb,
  sales_path JSONB DEFAULT '{}'::jsonb,
  riscos JSONB DEFAULT '[]'::jsonb,
  resumo_executivo TEXT,
  model_used TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imphq_sales_paths_project ON public.imphq_sales_paths(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imphq_sales_paths_user ON public.imphq_sales_paths(user_id, created_at DESC);

ALTER TABLE public.imphq_sales_paths ENABLE ROW LEVEL SECURITY;

-- Policies: usuários autenticados podem ler/criar/atualizar seus próprios paths
CREATE POLICY "Authenticated users can view sales paths"
  ON public.imphq_sales_paths FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales paths"
  ON public.imphq_sales_paths FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales paths"
  ON public.imphq_sales_paths FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete sales paths"
  ON public.imphq_sales_paths FOR DELETE
  TO authenticated
  USING (true);

-- Trigger updated_at
CREATE TRIGGER update_imphq_sales_paths_updated_at
  BEFORE UPDATE ON public.imphq_sales_paths
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
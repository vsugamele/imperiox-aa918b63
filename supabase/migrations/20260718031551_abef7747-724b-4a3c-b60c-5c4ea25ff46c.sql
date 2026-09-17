
ALTER TABLE public.imphq_empresa
  ADD COLUMN IF NOT EXISTS cloud_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS cloud_phone_provider TEXT,
  ADD COLUMN IF NOT EXISTS proxy_tipo TEXT,
  ADD COLUMN IF NOT EXISTS proxy_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS proxy_geo TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint_id TEXT,
  ADD COLUMN IF NOT EXISTS warmup_status TEXT DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warmup_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nicho TEXT,
  ADD COLUMN IF NOT EXISTS idioma TEXT DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS data_criacao_conta DATE,
  ADD COLUMN IF NOT EXISTS seguidores INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engajamento_medio NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_alcance INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sinais_risco JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pronta_venda BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preco_alvo NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS status_venda TEXT DEFAULT 'mantida',
  ADD COLUMN IF NOT EXISTS marketplace TEXT,
  ADD COLUMN IF NOT EXISTS comprador TEXT,
  ADD COLUMN IF NOT EXISTS revendedor_id UUID,
  ADD COLUMN IF NOT EXISTS observacoes_venda TEXT;

CREATE TABLE IF NOT EXISTS public.imphq_empresa_conteudo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id TEXT NOT NULL REFERENCES public.imphq_empresa(id) ON DELETE CASCADE,
  video_origem_url TEXT,
  video_processado_url TEXT,
  legenda TEXT,
  horario_agendado TIMESTAMPTZ,
  status TEXT DEFAULT 'fila',
  post_url TEXT,
  alcance INT DEFAULT 0,
  likes INT DEFAULT 0,
  comentarios INT DEFAULT 0,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_empresa_conteudo TO authenticated;
GRANT ALL ON public.imphq_empresa_conteudo TO service_role;
ALTER TABLE public.imphq_empresa_conteudo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage empresa conteudo" ON public.imphq_empresa_conteudo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_empresa_conteudo_conta ON public.imphq_empresa_conteudo(conta_id);
CREATE INDEX IF NOT EXISTS idx_empresa_conteudo_status ON public.imphq_empresa_conteudo(status, horario_agendado);

CREATE TABLE IF NOT EXISTS public.imphq_empresa_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id TEXT NOT NULL REFERENCES public.imphq_empresa(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_empresa_eventos TO authenticated;
GRANT ALL ON public.imphq_empresa_eventos TO service_role;
ALTER TABLE public.imphq_empresa_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage empresa eventos" ON public.imphq_empresa_eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_empresa_eventos_conta ON public.imphq_empresa_eventos(conta_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.imphq_empresa_check_venda()
RETURNS TRIGGER AS $$
DECLARE
  idade INT;
  sem_risco BOOLEAN;
BEGIN
  idade := COALESCE(EXTRACT(DAY FROM (now() - NEW.data_criacao_conta::timestamptz))::int, 0);
  sem_risco := (NEW.sinais_risco IS NULL OR jsonb_array_length(NEW.sinais_risco) = 0);
  NEW.pronta_venda := (
    idade >= 60
    AND COALESCE(NEW.seguidores,0) >= 1000
    AND COALESCE(NEW.engajamento_medio,0) >= 1.5
    AND sem_risco
    AND NEW.warmup_status = 'pronto'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_empresa_check_venda ON public.imphq_empresa;
CREATE TRIGGER trg_empresa_check_venda
  BEFORE INSERT OR UPDATE ON public.imphq_empresa
  FOR EACH ROW EXECUTE FUNCTION public.imphq_empresa_check_venda();

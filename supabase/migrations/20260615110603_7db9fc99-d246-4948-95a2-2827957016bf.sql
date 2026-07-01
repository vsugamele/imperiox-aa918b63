ALTER TABLE public.imphq_vendas ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_imphq_vendas_learned_at ON public.imphq_vendas (learned_at) WHERE learned_at IS NULL;
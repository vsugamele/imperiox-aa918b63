ALTER TABLE public.imphq_automacoes
  ADD COLUMN IF NOT EXISTS prioridade INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS exclusivo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_imphq_automacoes_prioridade ON public.imphq_automacoes (prioridade DESC);
CREATE INDEX IF NOT EXISTS idx_imphq_flow_executions_lead_status ON public.imphq_flow_executions (lead_id, status);
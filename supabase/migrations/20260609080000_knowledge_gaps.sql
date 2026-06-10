-- Knowledge gaps: coluna answered + índice para query de lacunas

-- Coluna answered: distingue perguntas já respondidas das pendentes
ALTER TABLE public.imphq_wa_knowledge
  ADD COLUMN IF NOT EXISTS answered boolean NOT NULL DEFAULT false;

-- Marcar como answered todas que já têm resposta preenchida e estão aprovadas
UPDATE public.imphq_wa_knowledge
  SET answered = true
  WHERE aprovada = true AND resposta IS NOT NULL AND resposta != '';

-- Índice para busca rápida de lacunas pendentes
CREATE INDEX IF NOT EXISTS idx_wa_knowledge_gaps
  ON public.imphq_wa_knowledge (project_id, answered, aprovada)
  WHERE answered = false AND aprovada = false;

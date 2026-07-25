ALTER TABLE public.imphq_empresa ADD COLUMN IF NOT EXISTS position integer;

-- Backfill: cards mais recentes (topo, como está a ordenação atual) ganham posições menores
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at DESC) * 100) AS pos
  FROM public.imphq_empresa
)
UPDATE public.imphq_empresa e SET position = r.pos FROM ranked r WHERE r.id = e.id AND e.position IS NULL;

CREATE INDEX IF NOT EXISTS idx_imphq_empresa_position ON public.imphq_empresa(position);
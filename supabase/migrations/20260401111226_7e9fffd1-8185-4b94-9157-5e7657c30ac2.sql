ALTER TABLE public.imphq_project_revenue
  ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS custo_produto numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.imphq_company_map_nodes
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer;
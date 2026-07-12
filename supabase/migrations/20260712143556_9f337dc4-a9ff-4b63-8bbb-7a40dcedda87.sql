
ALTER TABLE public.imphq_company_map_edges DROP CONSTRAINT IF EXISTS imphq_company_map_edges_source_id_fkey;
ALTER TABLE public.imphq_company_map_edges DROP CONSTRAINT IF EXISTS imphq_company_map_edges_target_id_fkey;
ALTER TABLE public.imphq_company_map_edges ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'node';
ALTER TABLE public.imphq_company_map_edges ADD COLUMN IF NOT EXISTS target_kind text NOT NULL DEFAULT 'node';
ALTER TABLE public.imphq_company_map_edges ALTER COLUMN source_id TYPE text USING source_id::text;
ALTER TABLE public.imphq_company_map_edges ALTER COLUMN target_id TYPE text USING target_id::text;


ALTER TABLE public.imphq_company_maps ADD COLUMN IF NOT EXISTS parent_node_id uuid REFERENCES public.imphq_company_map_nodes(id) ON DELETE CASCADE;
ALTER TABLE public.imphq_company_map_nodes ADD COLUMN IF NOT EXISTS show_live_kpis boolean DEFAULT false;
ALTER TABLE public.imphq_company_map_edges ADD COLUMN IF NOT EXISTS style text DEFAULT 'solid';
ALTER TABLE public.imphq_company_map_edges ADD COLUMN IF NOT EXISTS label text;
CREATE INDEX IF NOT EXISTS idx_company_maps_parent ON public.imphq_company_maps(parent_node_id);

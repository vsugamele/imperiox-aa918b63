
CREATE TABLE public.imphq_company_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Mapa da Empresa',
  viewport JSONB NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_company_maps TO authenticated;
GRANT ALL ON public.imphq_company_maps TO service_role;
ALTER TABLE public.imphq_company_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage company maps" ON public.imphq_company_maps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.imphq_company_map_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES public.imphq_company_maps(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Novo nó',
  kind TEXT NOT NULL DEFAULT 'canal',
  color TEXT NOT NULL DEFAULT '#f59e0b',
  description TEXT,
  notes TEXT,
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0}'::jsonb,
  size TEXT NOT NULL DEFAULT 'md',
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_funnel_id TEXT,
  linked_project_id TEXT,
  linked_flow_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_company_map_nodes TO authenticated;
GRANT ALL ON public.imphq_company_map_nodes TO service_role;
ALTER TABLE public.imphq_company_map_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage map nodes" ON public.imphq_company_map_nodes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_company_map_nodes_map ON public.imphq_company_map_nodes(map_id);

CREATE TABLE public.imphq_company_map_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES public.imphq_company_maps(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.imphq_company_map_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.imphq_company_map_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_company_map_edges TO authenticated;
GRANT ALL ON public.imphq_company_map_edges TO service_role;
ALTER TABLE public.imphq_company_map_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage map edges" ON public.imphq_company_map_edges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_company_map_edges_map ON public.imphq_company_map_edges(map_id);

CREATE OR REPLACE FUNCTION public.touch_company_map_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_company_maps_updated BEFORE UPDATE ON public.imphq_company_maps
  FOR EACH ROW EXECUTE FUNCTION public.touch_company_map_updated_at();
CREATE TRIGGER trg_company_map_nodes_updated BEFORE UPDATE ON public.imphq_company_map_nodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_company_map_updated_at();

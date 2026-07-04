CREATE TABLE public.imphq_company_map_annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id uuid NOT NULL REFERENCES public.imphq_company_maps(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('frame','note','label','arrow')),
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  width double precision NOT NULL DEFAULT 240,
  height double precision NOT NULL DEFAULT 160,
  text text DEFAULT '',
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  z_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_company_map_annotations TO authenticated;
GRANT ALL ON public.imphq_company_map_annotations TO service_role;

ALTER TABLE public.imphq_company_map_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users manage annotations"
  ON public.imphq_company_map_annotations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_annotations_map ON public.imphq_company_map_annotations(map_id);

CREATE TRIGGER trg_annotations_updated_at
  BEFORE UPDATE ON public.imphq_company_map_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
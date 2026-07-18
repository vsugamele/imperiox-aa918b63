
CREATE TABLE public.imphq_cloud_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'geelark',
  device_id text,
  nome text,
  proxy_tipo text,
  proxy_geo text,
  fingerprint_id text,
  status text NOT NULL DEFAULT 'ativo',
  project_id text REFERENCES public.imphq_projects(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_cloud_phones TO authenticated;
GRANT ALL ON public.imphq_cloud_phones TO service_role;
ALTER TABLE public.imphq_cloud_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage cloud phones" ON public.imphq_cloud_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX imphq_cloud_phones_project_idx ON public.imphq_cloud_phones(project_id);

CREATE OR REPLACE FUNCTION public.tg_imphq_cloud_phones_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER imphq_cloud_phones_set_updated
BEFORE UPDATE ON public.imphq_cloud_phones
FOR EACH ROW EXECUTE FUNCTION public.tg_imphq_cloud_phones_updated_at();

ALTER TABLE public.imphq_empresa
  ADD COLUMN IF NOT EXISTS cloud_phone_ref uuid REFERENCES public.imphq_cloud_phones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id text REFERENCES public.imphq_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS imphq_empresa_cloud_phone_ref_idx ON public.imphq_empresa(cloud_phone_ref);
CREATE INDEX IF NOT EXISTS imphq_empresa_project_id_idx ON public.imphq_empresa(project_id);

CREATE TABLE IF NOT EXISTS public.imphq_integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_integration_creds_project ON public.imphq_integration_credentials(project_id);

ALTER TABLE public.imphq_integration_credentials ENABLE ROW LEVEL SECURITY;

-- Authenticated users podem ler/escrever (igual padrão FB do projeto)
DROP POLICY IF EXISTS "integration_creds_auth_all" ON public.imphq_integration_credentials;
CREATE POLICY "integration_creds_auth_all" ON public.imphq_integration_credentials FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_int_creds_updated BEFORE UPDATE ON public.imphq_integration_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
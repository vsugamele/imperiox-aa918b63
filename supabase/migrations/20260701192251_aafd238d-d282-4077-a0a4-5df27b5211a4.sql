
CREATE TABLE IF NOT EXISTS public.imphq_zernio_api_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  action TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  status INTEGER,
  attempt INTEGER DEFAULT 1,
  request_payload JSONB,
  response_body JSONB,
  request_id TEXT,
  success BOOLEAN DEFAULT false,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zernio_calls_project_created ON public.imphq_zernio_api_calls(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zernio_calls_status ON public.imphq_zernio_api_calls(status) WHERE status >= 400;

GRANT SELECT ON public.imphq_zernio_api_calls TO authenticated;
GRANT ALL ON public.imphq_zernio_api_calls TO service_role;

ALTER TABLE public.imphq_zernio_api_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read zernio api calls"
  ON public.imphq_zernio_api_calls FOR SELECT
  TO authenticated
  USING (true);

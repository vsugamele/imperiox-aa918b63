CREATE TABLE public.imphq_referencias_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  project_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_referencias_pastas TO anon, authenticated;
GRANT ALL ON public.imphq_referencias_pastas TO service_role;
ALTER TABLE public.imphq_referencias_pastas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access referencias pastas" ON public.imphq_referencias_pastas FOR ALL USING (true) WITH CHECK (true);
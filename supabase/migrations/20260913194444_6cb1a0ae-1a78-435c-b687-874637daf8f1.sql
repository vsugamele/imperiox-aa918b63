ALTER TABLE public.imphq_wa_providers
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.imphq_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text,
  function_name text NOT NULL,
  provider text NOT NULL DEFAULT 'openrouter',
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.imphq_ai_usage TO authenticated;
GRANT ALL ON public.imphq_ai_usage TO service_role;

ALTER TABLE public.imphq_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_select_authenticated"
  ON public.imphq_ai_usage FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_desc ON public.imphq_ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_project ON public.imphq_ai_usage (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_function ON public.imphq_ai_usage (function_name, created_at DESC);
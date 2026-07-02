
CREATE TABLE IF NOT EXISTS public.imphq_product_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  produto_nome TEXT NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INT DEFAULT 0,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_blueprints_proj_prod
  ON public.imphq_product_blueprints (project_id, produto_nome, versao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_product_blueprints TO authenticated;
GRANT ALL ON public.imphq_product_blueprints TO service_role;

ALTER TABLE public.imphq_product_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users read blueprints"
  ON public.imphq_product_blueprints FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth users write blueprints"
  ON public.imphq_product_blueprints FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at_blueprints()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_blueprints_updated_at ON public.imphq_product_blueprints;
CREATE TRIGGER trg_blueprints_updated_at BEFORE UPDATE ON public.imphq_product_blueprints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_blueprints();

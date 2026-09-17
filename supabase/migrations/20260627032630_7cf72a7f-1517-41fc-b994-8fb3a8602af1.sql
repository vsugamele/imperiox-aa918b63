
-- 1. Variantes por nó
CREATE TABLE IF NOT EXISTS public.imphq_flow_node_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES public.imphq_flow_blueprints(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  block_id TEXT,
  variant_key TEXT NOT NULL,
  copy TEXT,
  image_url TEXT,
  weight INT NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'testing',
  impressions INT NOT NULL DEFAULT 0,
  conversions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blueprint_id, node_id, variant_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_node_variants TO authenticated;
GRANT ALL ON public.imphq_flow_node_variants TO service_role;
ALTER TABLE public.imphq_flow_node_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth manages variants"
  ON public.imphq_flow_node_variants
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_flow_variants_bp_node ON public.imphq_flow_node_variants(blueprint_id, node_id);

-- 2. variant_id em runtime events (coluna não existe ainda)
ALTER TABLE public.imphq_flow_runtime_events
  ADD COLUMN IF NOT EXISTS variant_id UUID;

CREATE INDEX IF NOT EXISTS idx_flow_runtime_variant ON public.imphq_flow_runtime_events(variant_id) WHERE variant_id IS NOT NULL;

-- 3. RPC para incrementar contadores de variante atomicamente
CREATE OR REPLACE FUNCTION public.increment_flow_variant_stat(
  p_variant_id UUID,
  p_field TEXT,
  p_delta INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field = 'impressions' THEN
    UPDATE public.imphq_flow_node_variants
       SET impressions = GREATEST(0, impressions + p_delta), updated_at = now()
     WHERE id = p_variant_id;
  ELSIF p_field = 'conversions' THEN
    UPDATE public.imphq_flow_node_variants
       SET conversions = GREATEST(0, conversions + p_delta), updated_at = now()
     WHERE id = p_variant_id;
  END IF;
END;
$$;

-- 4. Trigger updated_at
CREATE TRIGGER trg_flow_variants_updated
  BEFORE UPDATE ON public.imphq_flow_node_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

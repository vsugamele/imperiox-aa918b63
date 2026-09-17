
-- Wave 1: Exit Conditions + Version History for OpenFlow

-- 1) Exit Conditions on automations
ALTER TABLE public.imphq_automacoes
  ADD COLUMN IF NOT EXISTS exit_trigger_tipo TEXT,
  ADD COLUMN IF NOT EXISTS exit_trigger_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exit_cascade BOOLEAN NOT NULL DEFAULT false;

-- Allow 'exited' status on executions (no enum, just a doc note — column is TEXT)
-- Optional helper index for exit lookups
CREATE INDEX IF NOT EXISTS idx_imphq_automacoes_exit_trigger
  ON public.imphq_automacoes(project_id, exit_trigger_tipo)
  WHERE exit_trigger_tipo IS NOT NULL;

-- 2) Version history for automations
CREATE TABLE IF NOT EXISTS public.imphq_automacao_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automacao_id TEXT NOT NULL,
  versao_num INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (automacao_id, versao_num)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_automacao_versions TO authenticated;
GRANT ALL ON public.imphq_automacao_versions TO service_role;

ALTER TABLE public.imphq_automacao_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read automacao versions"
  ON public.imphq_automacao_versions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert automacao versions"
  ON public.imphq_automacao_versions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can delete automacao versions"
  ON public.imphq_automacao_versions FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_imphq_automacao_versions_aid
  ON public.imphq_automacao_versions(automacao_id, versao_num DESC);

-- 3) Trigger: snapshot BEFORE UPDATE, keep last 10
CREATE OR REPLACE FUNCTION public.snapshot_automacao_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- only snapshot when meaningful fields change
  IF (OLD.acoes IS DISTINCT FROM NEW.acoes)
     OR (OLD.nome IS DISTINCT FROM NEW.nome)
     OR (OLD.trigger_tipo IS DISTINCT FROM NEW.trigger_tipo)
     OR (OLD.exit_trigger_tipo IS DISTINCT FROM NEW.exit_trigger_tipo)
     OR (OLD.exit_trigger_payload IS DISTINCT FROM NEW.exit_trigger_payload)
     OR (OLD.exit_cascade IS DISTINCT FROM NEW.exit_cascade)
  THEN
    SELECT COALESCE(MAX(versao_num), 0) + 1 INTO next_num
      FROM public.imphq_automacao_versions WHERE automacao_id = OLD.id;

    INSERT INTO public.imphq_automacao_versions (automacao_id, versao_num, snapshot, criado_por)
    VALUES (
      OLD.id,
      next_num,
      to_jsonb(OLD),
      auth.uid()
    );

    -- Trim to last 10 snapshots
    DELETE FROM public.imphq_automacao_versions
    WHERE automacao_id = OLD.id
      AND versao_num <= next_num - 10;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_automacao_version ON public.imphq_automacoes;
CREATE TRIGGER trg_snapshot_automacao_version
  BEFORE UPDATE ON public.imphq_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_automacao_version();

-- 4) Health metrics view (last 7 days)
CREATE OR REPLACE VIEW public.imphq_automacao_health AS
WITH base AS (
  SELECT
    automacao_id,
    status,
    created_at
  FROM public.imphq_flow_executions
  WHERE created_at >= now() - INTERVAL '7 days'
)
SELECT
  automacao_id,
  COUNT(*)::int AS execucoes,
  COUNT(*) FILTER (WHERE status IN ('completed','partial'))::int AS sucessos,
  COUNT(*) FILTER (WHERE status = 'failed')::int AS falhas,
  COUNT(*) FILTER (WHERE status = 'waiting')::int AS aguardando,
  COUNT(*) FILTER (WHERE status = 'exited')::int AS saidas,
  CASE WHEN COUNT(*) > 0
    THEN (COUNT(*) FILTER (WHERE status IN ('completed','partial'))::numeric / COUNT(*)::numeric)
    ELSE 0
  END AS taxa_sucesso
FROM base
GROUP BY automacao_id;

GRANT SELECT ON public.imphq_automacao_health TO authenticated, service_role;

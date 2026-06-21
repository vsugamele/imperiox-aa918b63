
-- 1) Colunas
ALTER TABLE public.imphq_wa_project_rules
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.imphq_wa_project_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ab_group_id uuid,
  ADD COLUMN IF NOT EXISTS ab_status text CHECK (ab_status IN ('control','variant','winner','loser')),
  ADD COLUMN IF NOT EXISTS ab_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ab_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS imphq_wa_project_rules_embedding_idx
  ON public.imphq_wa_project_rules USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS imphq_wa_project_rules_ab_group_idx
  ON public.imphq_wa_project_rules (ab_group_id) WHERE ab_group_id IS NOT NULL;

-- 2) Tabela de aplicações de regras
CREATE TABLE IF NOT EXISTS public.imphq_wa_rule_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.imphq_wa_project_rules(id) ON DELETE CASCADE,
  ab_group_id uuid,
  project_id text NOT NULL,
  conversation_id uuid,
  lead_id text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  venda_id text
);

GRANT SELECT ON public.imphq_wa_rule_applications TO authenticated;
GRANT ALL    ON public.imphq_wa_rule_applications TO service_role;

CREATE INDEX IF NOT EXISTS rule_apps_rule_idx        ON public.imphq_wa_rule_applications (rule_id);
CREATE INDEX IF NOT EXISTS rule_apps_lead_recent_idx ON public.imphq_wa_rule_applications (lead_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS rule_apps_ab_group_idx    ON public.imphq_wa_rule_applications (ab_group_id) WHERE ab_group_id IS NOT NULL;

ALTER TABLE public.imphq_wa_rule_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth users read rule apps" ON public.imphq_wa_rule_applications;
CREATE POLICY "auth users read rule apps"
  ON public.imphq_wa_rule_applications FOR SELECT
  TO authenticated USING (true);

-- 3) RPC match_wa_rules
DROP FUNCTION IF EXISTS public.match_wa_rules(text, extensions.vector, int, float);
CREATE OR REPLACE FUNCTION public.match_wa_rules(
  p_project_id text,
  p_query_embedding extensions.vector,
  p_match_count int DEFAULT 5,
  p_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  rule_text text,
  rule_type text,
  ab_group_id uuid,
  ab_status text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT r.id, r.rule_text, r.rule_type, r.ab_group_id, r.ab_status,
         1.0::float AS similarity
  FROM public.imphq_wa_project_rules r
  WHERE r.project_id = p_project_id
    AND r.active = true
    AND r.rule_type = 'unavailable_product'
  UNION
  SELECT r.id, r.rule_text, r.rule_type, r.ab_group_id, r.ab_status,
         (1 - (r.embedding OPERATOR(extensions.<=>) p_query_embedding))::float AS similarity
  FROM public.imphq_wa_project_rules r
  WHERE r.project_id = p_project_id
    AND r.active = true
    AND r.rule_type <> 'unavailable_product'
    AND r.embedding IS NOT NULL
    AND (1 - (r.embedding OPERATOR(extensions.<=>) p_query_embedding)) >= p_threshold
  ORDER BY similarity DESC
  LIMIT p_match_count;
$$;

-- 4) Trigger venda → conversões
CREATE OR REPLACE FUNCTION public.attribute_venda_to_wa_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead text;
BEGIN
  v_lead := COALESCE(NEW.lead_id::text, NEW.email, NEW.phone);
  IF v_lead IS NULL THEN RETURN NEW; END IF;

  UPDATE public.imphq_wa_rule_applications app
     SET converted_at = now(),
         venda_id     = NEW.id::text
   WHERE app.lead_id = v_lead
     AND app.converted_at IS NULL
     AND app.applied_at >= now() - interval '7 days';

  UPDATE public.imphq_wa_project_rules r
     SET conversion_count = conversion_count + 1
   WHERE r.id IN (
     SELECT app.rule_id FROM public.imphq_wa_rule_applications app
      WHERE app.venda_id = NEW.id::text
   );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attribute_venda_to_wa_rules ON public.imphq_vendas;
CREATE TRIGGER trg_attribute_venda_to_wa_rules
  AFTER INSERT ON public.imphq_vendas
  FOR EACH ROW EXECUTE FUNCTION public.attribute_venda_to_wa_rules();

-- 5) Avaliação A/B
CREATE OR REPLACE FUNCTION public.evaluate_wa_rules_ab(p_min_sample int DEFAULT 30)
RETURNS TABLE (group_id uuid, winner_id uuid, loser_id uuid, winner_rate float, loser_rate float)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT r.ab_group_id,
           r.id,
           r.times_applied,
           r.conversion_count,
           CASE WHEN r.times_applied > 0
                THEN r.conversion_count::float / r.times_applied
                ELSE 0 END AS rate
      FROM public.imphq_wa_project_rules r
     WHERE r.ab_group_id IS NOT NULL
       AND r.ab_status IN ('control','variant')
  ),
  groups AS (
    SELECT s.ab_group_id,
           MIN(s.times_applied) AS min_apps
      FROM stats s
     GROUP BY s.ab_group_id
    HAVING MIN(s.times_applied) >= p_min_sample
       AND COUNT(*) >= 2
  )
  SELECT g.ab_group_id,
         (SELECT s.id FROM stats s WHERE s.ab_group_id = g.ab_group_id ORDER BY s.rate DESC LIMIT 1),
         (SELECT s.id FROM stats s WHERE s.ab_group_id = g.ab_group_id ORDER BY s.rate ASC  LIMIT 1),
         (SELECT MAX(s.rate) FROM stats s WHERE s.ab_group_id = g.ab_group_id),
         (SELECT MIN(s.rate) FROM stats s WHERE s.ab_group_id = g.ab_group_id)
    FROM groups g;
END;
$$;

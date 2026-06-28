
DROP FUNCTION IF EXISTS public.normalize_br_phone(text) CASCADE;

ALTER TABLE public.imphq_wa_lead_memories
  ADD COLUMN IF NOT EXISTS cross_shareable boolean NOT NULL DEFAULT true;

CREATE FUNCTION public.normalize_br_phone(p_phone text)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  clean text;
  v text[];
BEGIN
  clean := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v := ARRAY[clean];
  IF clean LIKE '55%' THEN
    IF length(clean) = 13 AND substring(clean,5,1) = '9' THEN
      v := v || (substring(clean,1,4) || substring(clean,6));
    ELSIF length(clean) = 12 THEN
      v := v || (substring(clean,1,4) || '9' || substring(clean,5));
    END IF;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_lead_cross_memory(
  p_phone text,
  p_current_project_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  variants text[];
  result jsonb;
BEGIN
  variants := public.normalize_br_phone(p_phone);

  WITH leads AS (
    SELECT id, project_id, name, dor_principal, objecao_atual,
           ultimo_interesse, nivel_qualificacao, updated_at, lead_memory
    FROM public.imphq_leads
    WHERE phone = ANY(variants)
      AND (p_current_project_id IS NULL OR project_id::text <> p_current_project_id)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 10
  ),
  vendas AS (
    SELECT v.produto_nome, v.valor, v.project_id, v.created_at
    FROM public.imphq_vendas v
    WHERE v.lead_id IN (SELECT id FROM leads)
      AND lower(coalesce(v.status,'')) IN ('paga','aprovada','approved','paid')
    ORDER BY v.created_at DESC
    LIMIT 5
  ),
  mems AS (
    SELECT content, memory_type, project_id, created_at
    FROM public.imphq_wa_lead_memories
    WHERE phone = ANY(variants)
      AND cross_shareable = true
      AND (p_current_project_id IS NULL OR project_id::text <> p_current_project_id)
    ORDER BY created_at DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'leads', coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM leads l), '[]'::jsonb),
    'vendas', coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM vendas v), '[]'::jsonb),
    'memories', coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM mems m), '[]'::jsonb)
  ) INTO result;

  RETURN coalesce(result, jsonb_build_object('leads','[]'::jsonb,'vendas','[]'::jsonb,'memories','[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_lead_cross_memory(text, text) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_wa_lead_memories_phone ON public.imphq_wa_lead_memories(phone);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.imphq_leads(phone);

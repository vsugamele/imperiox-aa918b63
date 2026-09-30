-- Migração de correção de erros nos logs do Postgres
-- 1. Permite geração automática de UUID em imphq_events.id e define default para visitor_id
ALTER TABLE public.imphq_events 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN visitor_id DROP NOT NULL,
  ALTER COLUMN visitor_id SET DEFAULT 'system';

ALTER TABLE public.imphq_events 
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Corrige a função get_lead_cross_memory para usar "nome AS name"
CREATE OR REPLACE FUNCTION public.get_lead_cross_memory(p_phone text, p_current_project_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  variants text[];
  result jsonb;
BEGIN
  variants := public.normalize_br_phone(p_phone);

  WITH leads AS (
    SELECT id, project_id, nome AS name, dor_principal, objecao_atual,
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
$function$;

-- 3. Adiciona coluna primary_color em areamembrojp_tenant_settings
ALTER TABLE public.areamembrojp_tenant_settings 
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0f172a';

UPDATE public.areamembrojp_tenant_settings 
SET primary_color = '#0f172a' 
WHERE primary_color IS NULL;

-- 4. Adiciona colunas recorrentes identificadas nos logs
ALTER TABLE public.imphq_wa_messages 
  ADD COLUMN IF NOT EXISTS from_me boolean DEFAULT false;

UPDATE public.imphq_wa_messages 
SET from_me = (direction = 'out') 
WHERE from_me IS NULL;

ALTER TABLE public.imphq_wa_conversations 
  ADD COLUMN IF NOT EXISTS ai_paused boolean DEFAULT false;

ALTER TABLE public.imphq_ads_spend 
  ADD COLUMN IF NOT EXISTS valor_conversao numeric DEFAULT 0;

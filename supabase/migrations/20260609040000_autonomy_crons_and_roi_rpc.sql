-- Crons de autonomia + RPC de ROI por fluxo
-- 1. wa-knowledge-autofill — toda segunda-feira às 3h (preenche lacunas de conhecimento)
-- 2. lead-score-updater — todo dia às 2h (score dinâmico de leads)
-- 3. ab-test-promoter — todo dia às 4h (promoção automática de vencedor A/B)
-- 4. flow_roi_by_automation — RPC para dashboard de ROI por fluxo

-- ── Cron: wa-knowledge-autofill ──────────────────────────────────────────────
SELECT cron.schedule(
  'wa-knowledge-autofill-weekly',
  '0 3 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/wa-knowledge-autofill',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- ── Cron: lead-score-updater ─────────────────────────────────────────────────
SELECT cron.schedule(
  'lead-score-updater-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/lead-score-updater',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- ── Cron: ab-test-promoter ───────────────────────────────────────────────────
SELECT cron.schedule(
  'ab-test-promoter-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/ab-test-promoter',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- ── RPC: flow_roi_by_automation ──────────────────────────────────────────────
-- Cruza flow_attribution events com vendas para calcular receita atribuída por fluxo
CREATE OR REPLACE FUNCTION public.flow_roi_by_automation(
  p_project_id text,
  p_since timestamptz DEFAULT now() - interval '30 days'
)
RETURNS TABLE (
  automacao_id   text,
  automacao_nome text,
  conversions    bigint,
  revenue_total  numeric,
  avg_ticket     numeric,
  leads_touched  bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH attributions AS (
    SELECT
      (e.event_data->>'automacao_id')   AS automacao_id,
      (e.event_data->>'automacao_nome') AS automacao_nome,
      (e.event_data->>'lead_id')        AS lead_id
    FROM public.imphq_events e
    WHERE e.project_id = p_project_id
      AND e.event_name = 'flow_attribution'
      AND e.created_at >= p_since
  ),
  touched AS (
    -- também conta leads que passaram pelo fluxo mas não converteram
    SELECT
      (e.event_data->>'automacao_id')   AS automacao_id,
      (e.event_data->>'automacao_nome') AS automacao_nome,
      COUNT(DISTINCT (e.event_data->>'lead_id')) AS leads_touched
    FROM public.imphq_events e
    WHERE e.project_id = p_project_id
      AND e.event_name IN ('flow_attribution', 'flow_started')
      AND e.created_at >= p_since
    GROUP BY 1, 2
  ),
  sales AS (
    SELECT
      a.automacao_id,
      a.automacao_nome,
      COUNT(*)                         AS conversions,
      COALESCE(SUM(v.valor), 0)        AS revenue_total
    FROM attributions a
    LEFT JOIN public.imphq_vendas v
      ON v.lead_id = a.lead_id
      AND v.status = 'aprovado'
      AND v.created_at >= p_since
    GROUP BY a.automacao_id, a.automacao_nome
  )
  SELECT
    s.automacao_id,
    s.automacao_nome,
    s.conversions,
    s.revenue_total,
    CASE WHEN s.conversions > 0 THEN ROUND(s.revenue_total / s.conversions, 2) ELSE 0 END AS avg_ticket,
    COALESCE(t.leads_touched, 0) AS leads_touched
  FROM sales s
  LEFT JOIN touched t USING (automacao_id)
  ORDER BY s.revenue_total DESC;
$$;

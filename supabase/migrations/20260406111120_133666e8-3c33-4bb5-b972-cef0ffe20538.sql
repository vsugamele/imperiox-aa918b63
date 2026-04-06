
-- 1. View consolidada de finanças por projeto
CREATE OR REPLACE VIEW public.vw_financas_resumo AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.icon AS project_icon,
  COALESCE(v.total_vendas, 0) AS total_vendas,
  COALESCE(v.qtd_vendas, 0) AS qtd_vendas,
  COALESCE(r.total_receita_manual, 0) AS total_receita_manual,
  COALESCE(v.total_vendas, 0) + COALESCE(r.total_receita_manual, 0) AS receita_total,
  COALESCE(c.total_custos, 0) AS total_custos,
  COALESCE(a.total_ads, 0) AS total_ads,
  COALESCE(c.total_custos, 0) + COALESCE(a.total_ads, 0) AS custo_total,
  COALESCE(v.total_vendas, 0) + COALESCE(r.total_receita_manual, 0)
    - COALESCE(c.total_custos, 0) - COALESCE(a.total_ads, 0) AS lucro_liquido,
  CASE WHEN COALESCE(a.total_ads, 0) > 0
    THEN ROUND(((COALESCE(v.total_vendas, 0) + COALESCE(r.total_receita_manual, 0)) / a.total_ads)::numeric, 2)
    ELSE 0 END AS roas,
  COALESCE(a.total_leads, 0) AS total_leads_ads,
  CASE WHEN COALESCE(a.total_leads, 0) > 0
    THEN ROUND((a.total_ads / a.total_leads)::numeric, 2)
    ELSE 0 END AS cpl,
  CASE WHEN COALESCE(v.qtd_vendas, 0) > 0
    THEN ROUND((a.total_ads / v.qtd_vendas)::numeric, 2)
    ELSE 0 END AS cpa
FROM public.imphq_projects p
LEFT JOIN (
  SELECT project_id, SUM(valor) AS total_vendas, COUNT(*) AS qtd_vendas
  FROM public.imphq_vendas WHERE status = 'aprovado' GROUP BY project_id
) v ON v.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(valor) AS total_receita_manual
  FROM public.imphq_project_revenue GROUP BY project_id
) r ON r.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(CASE WHEN moeda = 'USD' THEN valor * 5.2 ELSE valor END) AS total_custos
  FROM public.imphq_project_costs GROUP BY project_id
) c ON c.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(valor) AS total_ads, SUM(COALESCE(leads, 0)) AS total_leads
  FROM public.imphq_ads_spend GROUP BY project_id
) a ON a.project_id = p.id;

-- 2. Tabela de erros de webhook
CREATE TABLE IF NOT EXISTS public.imphq_webhook_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID REFERENCES public.imphq_webhooks(id),
  project_id TEXT,
  plataforma TEXT,
  evento TEXT,
  erro TEXT NOT NULL,
  payload JSONB,
  reprocessado BOOLEAN DEFAULT false,
  reprocessado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_webhook_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view webhook errors"
  ON public.imphq_webhook_errors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update webhook errors"
  ON public.imphq_webhook_errors FOR UPDATE TO authenticated USING (true);

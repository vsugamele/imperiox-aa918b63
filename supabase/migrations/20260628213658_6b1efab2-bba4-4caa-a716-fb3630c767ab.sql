
CREATE OR REPLACE VIEW public.vw_attribution_unified AS
SELECT
  v.id AS venda_id,
  v.project_id,
  v.lead_id,
  v.produto_nome,
  v.valor,
  v.valor_liquido,
  v.tipo_venda,
  v.plataforma AS plataforma_venda,
  v.data_venda,
  wa.source AS wa_source,
  wa.source_detail AS wa_source_detail,
  wa.template_name AS wa_template,
  wa.clicked_at AS wa_clicked_at,
  COALESCE(v.utm_source, c.utm_source) AS utm_source,
  COALESCE(v.utm_medium, c.utm_medium) AS utm_medium,
  COALESCE(v.utm_campaign, c.utm_campaign) AS utm_campaign,
  COALESCE(v.utm_content, c.utm_content) AS utm_content,
  COALESCE(v.utm_term, c.utm_term) AS utm_term,
  c.created_at AS first_click_at,
  CASE
    WHEN wa.venda_id IS NOT NULL THEN 'whatsapp'
    WHEN COALESCE(v.utm_source, c.utm_source) IS NOT NULL THEN 'ads'
    ELSE 'organic'
  END AS canal_atribuido
FROM public.imphq_vendas v
LEFT JOIN public.imphq_wa_attribution wa ON wa.venda_id = v.id
LEFT JOIN LATERAL (
  SELECT * FROM public.imphq_clicks
  WHERE lead_id = v.lead_id
  ORDER BY created_at ASC
  LIMIT 1
) c ON true;

GRANT SELECT ON public.vw_attribution_unified TO authenticated;

CREATE TABLE IF NOT EXISTS public.imphq_copy_sync_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  source_field text NOT NULL,
  target_type text NOT NULL,
  target_ref_id text NOT NULL,
  target_field text NOT NULL,
  auto_apply boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_copy_sync_bindings TO authenticated;
GRANT ALL ON public.imphq_copy_sync_bindings TO service_role;

ALTER TABLE public.imphq_copy_sync_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_copy_sync" ON public.imphq_copy_sync_bindings
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_copy_sync_project ON public.imphq_copy_sync_bindings(project_id);
CREATE INDEX IF NOT EXISTS idx_copy_sync_source ON public.imphq_copy_sync_bindings(source_type, source_id);

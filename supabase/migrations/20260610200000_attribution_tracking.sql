ALTER TABLE public.imphq_wa_messages
  ADD COLUMN IF NOT EXISTS attribution_id text;

CREATE TABLE IF NOT EXISTS public.imphq_wa_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id text NOT NULL UNIQUE,
  project_id text NOT NULL,
  conversation_id uuid REFERENCES public.imphq_wa_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.imphq_wa_messages(id) ON DELETE SET NULL,
  phone text,
  link_url text NOT NULL,
  source text NOT NULL,
  source_detail text,
  template_name text,
  campaign_id text,
  produto_nome text,
  sent_at timestamptz DEFAULT now(),
  click_id text,
  clicked_at timestamptz,
  venda_id text,
  venda_status text,
  matched_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_attribution_project ON public.imphq_wa_attribution (project_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_source ON public.imphq_wa_attribution (project_id, source, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_clickid ON public.imphq_wa_attribution (click_id) WHERE click_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attribution_phone ON public.imphq_wa_attribution (phone, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_venda ON public.imphq_wa_attribution (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attribution_msgs_attr_id ON public.imphq_wa_messages (attribution_id) WHERE attribution_id IS NOT NULL;

ALTER TABLE public.imphq_wa_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attribution_select_auth" ON public.imphq_wa_attribution;
CREATE POLICY "attribution_select_auth" ON public.imphq_wa_attribution
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "attribution_service" ON public.imphq_wa_attribution;
CREATE POLICY "attribution_service" ON public.imphq_wa_attribution
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW public.imphq_wa_funnel_daily AS
SELECT
  a.project_id,
  date_trunc('day', a.sent_at) AS day,
  a.source,
  COUNT(*) AS links_enviados,
  COUNT(*) FILTER (WHERE a.clicked_at IS NOT NULL) AS links_clicados,
  COUNT(*) FILTER (WHERE a.venda_id IS NOT NULL) AS vendas_geradas,
  COUNT(*) FILTER (WHERE a.venda_status = 'aprovado') AS vendas_aprovadas
FROM public.imphq_wa_attribution a
GROUP BY 1, 2, 3
ORDER BY 2 DESC, 1, 3;

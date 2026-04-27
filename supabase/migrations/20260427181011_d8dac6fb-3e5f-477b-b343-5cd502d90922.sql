-- Adicionar IDs e status das entidades Meta no imphq_ads_spend
ALTER TABLE public.imphq_ads_spend
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS effective_status text,
  ADD COLUMN IF NOT EXISTS daily_budget numeric;

CREATE INDEX IF NOT EXISTS idx_ads_spend_campaign_id ON public.imphq_ads_spend(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_spend_project_data ON public.imphq_ads_spend(project_id, data_ref DESC);

-- Histórico de ações no Gerenciador
CREATE TABLE IF NOT EXISTS public.imphq_ads_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text,
  plataforma text NOT NULL DEFAULT 'Facebook',
  tipo text NOT NULL,                 -- campaign | adset | ad
  entidade_id text NOT NULL,
  entidade_nome text,
  acao text NOT NULL,                 -- ativou | pausou | orcamento | ...
  valor_anterior text,
  valor_novo text,
  resultado text NOT NULL DEFAULT 'ok', -- ok | erro
  erro_msg text,
  duracao_ms integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_actions_project_created ON public.imphq_ads_actions(project_id, created_at DESC);

ALTER TABLE public.imphq_ads_actions ENABLE ROW LEVEL SECURITY;

-- Leitura/escrita liberada para usuários autenticados (segue padrão das outras tabelas imphq_)
CREATE POLICY "ads_actions_select_authenticated"
  ON public.imphq_ads_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ads_actions_insert_authenticated"
  ON public.imphq_ads_actions FOR INSERT
  TO authenticated
  WITH CHECK (true);

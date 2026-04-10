
CREATE TABLE public.imphq_wa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text,
  provider_id uuid REFERENCES public.imphq_wa_providers(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their campaigns"
  ON public.imphq_wa_campaigns FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_imphq_wa_campaigns_updated_at
  BEFORE UPDATE ON public.imphq_wa_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.imphq_wa_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.imphq_wa_campaigns(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 0,
  content text,
  media_url text,
  media_type text NOT NULL DEFAULT 'text',
  send_time time NOT NULL DEFAULT '09:00',
  days_offset int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage campaign steps"
  ON public.imphq_wa_campaign_steps FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.imphq_wa_campaign_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid REFERENCES public.imphq_wa_campaign_steps(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.imphq_wa_campaigns(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_campaign_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign logs"
  ON public.imphq_wa_campaign_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert campaign logs"
  ON public.imphq_wa_campaign_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_campaign_logs_campaign ON public.imphq_wa_campaign_logs(campaign_id);
CREATE INDEX idx_campaign_steps_campaign ON public.imphq_wa_campaign_steps(campaign_id);
CREATE INDEX idx_campaigns_status ON public.imphq_wa_campaigns(status);

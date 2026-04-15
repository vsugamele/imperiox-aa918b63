
-- Group distributor links
CREATE TABLE public.imphq_wa_group_distributors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.imphq_wa_campaigns(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  max_per_group INTEGER NOT NULL DEFAULT 250,
  redirect_order TEXT[] NOT NULL DEFAULT '{}',
  click_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_group_distributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage distributors"
  ON public.imphq_wa_group_distributors FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Click tracking
CREATE TABLE public.imphq_wa_distributor_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.imphq_wa_group_distributors(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_distributor_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read clicks"
  ON public.imphq_wa_distributor_clicks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Anyone can insert clicks"
  ON public.imphq_wa_distributor_clicks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Index for fast slug lookup
CREATE INDEX idx_distributor_slug ON public.imphq_wa_group_distributors(slug);
CREATE INDEX idx_distributor_clicks_dist ON public.imphq_wa_distributor_clicks(distributor_id);

-- Updated_at trigger
CREATE TRIGGER update_distributors_updated_at
  BEFORE UPDATE ON public.imphq_wa_group_distributors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

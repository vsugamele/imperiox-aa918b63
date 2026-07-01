-- ============ imphq_ig_media ============
CREATE TABLE IF NOT EXISTS public.imphq_ig_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.imphq_ig_accounts(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  ig_media_id TEXT NOT NULL,
  zernio_post_id TEXT,
  media_type TEXT,
  media_product_type TEXT,
  caption TEXT,
  permalink TEXT,
  thumbnail_url TEXT,
  media_url TEXT,
  posted_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, ig_media_id)
);

CREATE INDEX IF NOT EXISTS idx_ig_media_project ON public.imphq_ig_media (project_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_media_account ON public.imphq_ig_media (account_id, posted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_ig_media TO authenticated;
GRANT ALL ON public.imphq_ig_media TO service_role;

ALTER TABLE public.imphq_ig_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ig_media" ON public.imphq_ig_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role manage ig_media" ON public.imphq_ig_media FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ imphq_ig_media_insights ============
CREATE TABLE IF NOT EXISTS public.imphq_ig_media_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID NOT NULL REFERENCES public.imphq_ig_media(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  video_views INTEGER NOT NULL DEFAULT 0,
  engagement INTEGER NOT NULL DEFAULT 0,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ig_media_insights_media ON public.imphq_ig_media_insights (media_id, snapshot_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_ig_media_insights TO authenticated;
GRANT ALL ON public.imphq_ig_media_insights TO service_role;

ALTER TABLE public.imphq_ig_media_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ig_media_insights" ON public.imphq_ig_media_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role manage ig_media_insights" ON public.imphq_ig_media_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ imphq_ig_account_insights ============
CREATE TABLE IF NOT EXISTS public.imphq_ig_account_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.imphq_ig_accounts(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followers_count INTEGER NOT NULL DEFAULT 0,
  follows_count INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  profile_views INTEGER NOT NULL DEFAULT 0,
  website_clicks INTEGER NOT NULL DEFAULT 0,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ig_account_insights_project ON public.imphq_ig_account_insights (project_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_ig_account_insights_account ON public.imphq_ig_account_insights (account_id, snapshot_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_ig_account_insights TO authenticated;
GRANT ALL ON public.imphq_ig_account_insights TO service_role;

ALTER TABLE public.imphq_ig_account_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ig_account_insights" ON public.imphq_ig_account_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role manage ig_account_insights" ON public.imphq_ig_account_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger reaproveitando função existente, ou criando se faltar
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_updated_at_ig_media ON public.imphq_ig_media;
CREATE TRIGGER set_updated_at_ig_media
BEFORE UPDATE ON public.imphq_ig_media
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
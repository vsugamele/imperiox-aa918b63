ALTER TABLE public.imphq_ads_spend
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS creative_body TEXT,
  ADD COLUMN IF NOT EXISTS creative_title TEXT;
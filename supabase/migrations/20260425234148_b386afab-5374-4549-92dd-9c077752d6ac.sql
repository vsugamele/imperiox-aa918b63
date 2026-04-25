ALTER TABLE public.imphq_wa_campaigns
  ADD COLUMN IF NOT EXISTS paused_groups TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.imphq_wa_campaign_steps
  ADD COLUMN IF NOT EXISTS content_b TEXT;

ALTER TABLE public.imphq_wa_group_distributors
  ADD COLUMN IF NOT EXISTS weights JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.imphq_ads_spend ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'meta';
ALTER TABLE public.imphq_ads_actions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'meta';
CREATE INDEX IF NOT EXISTS idx_imphq_ads_spend_source ON public.imphq_ads_spend(project_id, source, data_ref);

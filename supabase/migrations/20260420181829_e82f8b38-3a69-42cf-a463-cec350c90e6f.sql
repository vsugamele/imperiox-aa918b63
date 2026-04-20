-- Phase 2: versioning support for creative assets
ALTER TABLE public.imphq_creative_assets
  ADD COLUMN IF NOT EXISTS parent_asset_id UUID REFERENCES public.imphq_creative_assets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS edit_instruction TEXT,
  ADD COLUMN IF NOT EXISTS exported_to_midia BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS midia_id UUID;

CREATE INDEX IF NOT EXISTS idx_creative_assets_parent ON public.imphq_creative_assets(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_batch ON public.imphq_creative_assets(batch_id);
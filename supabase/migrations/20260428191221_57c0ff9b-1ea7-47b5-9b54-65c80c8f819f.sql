ALTER TABLE public.imphq_creative_assets 
  ADD COLUMN IF NOT EXISTS image_provider TEXT DEFAULT 'lovable-gemini';
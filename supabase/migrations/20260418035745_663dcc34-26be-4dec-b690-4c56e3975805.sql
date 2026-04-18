ALTER TABLE public.imphq_generated_contents 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS funnel_stage TEXT,
  ADD COLUMN IF NOT EXISTS variation_group UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID;
CREATE INDEX IF NOT EXISTS idx_gen_contents_status ON public.imphq_generated_contents(status);
CREATE INDEX IF NOT EXISTS idx_gen_contents_variation ON public.imphq_generated_contents(variation_group);
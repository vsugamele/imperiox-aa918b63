ALTER TABLE public.imphq_studio_canvas_nodes 
  ADD COLUMN IF NOT EXISTS batch_group_id UUID,
  ADD COLUMN IF NOT EXISTS variant_of UUID REFERENCES public.imphq_studio_canvas_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS variant_angulo TEXT,
  ADD COLUMN IF NOT EXISTS variant_score NUMERIC,
  ADD COLUMN IF NOT EXISTS variant_score_data JSONB,
  ADD COLUMN IF NOT EXISTS is_variant_winner BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_studio_nodes_batch ON public.imphq_studio_canvas_nodes(batch_group_id);
CREATE INDEX IF NOT EXISTS idx_studio_nodes_variant_of ON public.imphq_studio_canvas_nodes(variant_of);
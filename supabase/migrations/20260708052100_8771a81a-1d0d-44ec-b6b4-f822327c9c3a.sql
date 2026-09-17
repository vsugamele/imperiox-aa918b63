
-- Nodes
CREATE TABLE public.imphq_studio_canvas_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.imphq_studio_workflows(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_studio_canvas_nodes TO authenticated;
GRANT ALL ON public.imphq_studio_canvas_nodes TO service_role;

ALTER TABLE public.imphq_studio_canvas_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages canvas nodes"
ON public.imphq_studio_canvas_nodes FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.imphq_studio_workflows w
  WHERE w.id = workflow_id AND w.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.imphq_studio_workflows w
  WHERE w.id = workflow_id AND w.user_id = auth.uid()
));

-- Edges
CREATE TABLE public.imphq_studio_canvas_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.imphq_studio_workflows(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.imphq_studio_canvas_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.imphq_studio_canvas_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_studio_canvas_edges TO authenticated;
GRANT ALL ON public.imphq_studio_canvas_edges TO service_role;

ALTER TABLE public.imphq_studio_canvas_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages canvas edges"
ON public.imphq_studio_canvas_edges FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.imphq_studio_workflows w
  WHERE w.id = workflow_id AND w.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.imphq_studio_workflows w
  WHERE w.id = workflow_id AND w.user_id = auth.uid()
));

-- Updated at trigger (reuse existing function if any, else create)
CREATE OR REPLACE FUNCTION public.tg_studio_canvas_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_studio_canvas_nodes_touch
BEFORE UPDATE ON public.imphq_studio_canvas_nodes
FOR EACH ROW EXECUTE FUNCTION public.tg_studio_canvas_touch();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_studio_canvas_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_studio_canvas_edges;

-- Add projeto_id + produto_idx to workflows if not present
ALTER TABLE public.imphq_studio_workflows
  ADD COLUMN IF NOT EXISTS projeto_id TEXT,
  ADD COLUMN IF NOT EXISTS produto_idx INTEGER DEFAULT 0;

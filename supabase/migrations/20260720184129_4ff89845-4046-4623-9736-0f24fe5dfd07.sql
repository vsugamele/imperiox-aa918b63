CREATE TABLE public.imphq_studio_publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES public.imphq_studio_workflows(id) ON DELETE CASCADE,
  node_id UUID REFERENCES public.imphq_studio_canvas_nodes(id) ON DELETE SET NULL,
  source_node_id UUID REFERENCES public.imphq_studio_canvas_nodes(id) ON DELETE SET NULL,
  projeto_id TEXT,
  produto_idx INT,
  media_url TEXT,
  media_kind TEXT,
  caption TEXT,
  channel TEXT NOT NULL DEFAULT 'salvar',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rascunho',
  error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_studio_publications TO authenticated;
GRANT ALL ON public.imphq_studio_publications TO service_role;

ALTER TABLE public.imphq_studio_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pubs_own" ON public.imphq_studio_publications
FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_studio_pub_workflow ON public.imphq_studio_publications(workflow_id, created_at DESC);
CREATE INDEX idx_studio_pub_scheduled ON public.imphq_studio_publications(status, scheduled_at) WHERE status = 'agendado';

CREATE TRIGGER trg_studio_pub_touch BEFORE UPDATE ON public.imphq_studio_publications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_studio_publications;
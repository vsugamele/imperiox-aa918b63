
-- 1) Tabela de custos por modelo (referência)
CREATE TABLE IF NOT EXISTS public.imphq_studio_model_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  cost_credits NUMERIC NOT NULL DEFAULT 0,
  avg_seconds INTEGER NOT NULL DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, model)
);

GRANT SELECT ON public.imphq_studio_model_costs TO authenticated;
GRANT ALL ON public.imphq_studio_model_costs TO service_role;

ALTER TABLE public.imphq_studio_model_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read model costs"
  ON public.imphq_studio_model_costs FOR SELECT
  TO authenticated USING (true);

-- Seed inicial
INSERT INTO public.imphq_studio_model_costs (kind, provider, model, cost_credits, avg_seconds, notes) VALUES
  ('image', 'kie', 'nano-banana-2', 2, 15, 'Rápido, ótimo para storyboards'),
  ('image', 'kie', 'seedream-4', 3, 20, 'Foto-realista'),
  ('image', 'kie', 'ideogram-v3', 3, 20, 'Melhor para texto na imagem'),
  ('image', 'kie', 'flux-kontext-pro', 4, 25, 'Edição contextual'),
  ('video', 'kie', 'veo3.1', 25, 90, 'Alta qualidade'),
  ('video', 'kie', 'veo3-fast', 12, 45, 'Rápido'),
  ('video', 'kie', 'kling-2.1', 15, 60, 'Kling 2.1'),
  ('video', 'kie', 'seedance-2', 20, 90, 'Lipsync avatar'),
  ('audio', 'elevenlabs', 'eleven_multilingual_v2', 1, 5, 'TTS multilíngue')
ON CONFLICT (provider, model) DO NOTHING;

-- 2) Tabela de eventos de execução (log stream)
CREATE TABLE IF NOT EXISTS public.imphq_studio_canvas_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.imphq_studio_workflows(id) ON DELETE CASCADE,
  node_id UUID REFERENCES public.imphq_studio_canvas_nodes(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_run_events_workflow ON public.imphq_studio_canvas_run_events(workflow_id, created_at DESC);

GRANT SELECT ON public.imphq_studio_canvas_run_events TO authenticated;
GRANT ALL ON public.imphq_studio_canvas_run_events TO service_role;

ALTER TABLE public.imphq_studio_canvas_run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads run events"
  ON public.imphq_studio_canvas_run_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.imphq_studio_workflows w
    WHERE w.id = imphq_studio_canvas_run_events.workflow_id
      AND w.user_id = auth.uid()
  ));

-- 3) Colunas novas em canvas_nodes
ALTER TABLE public.imphq_studio_canvas_nodes
  ADD COLUMN IF NOT EXISTS cost_actual NUMERIC,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS config_hash TEXT,
  ADD COLUMN IF NOT EXISTS cached_from_hash TEXT;

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_studio_canvas_run_events;

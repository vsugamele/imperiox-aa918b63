CREATE TABLE public.imphq_flow_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  produto_id TEXT,
  produto_nome TEXT,
  title TEXT NOT NULL DEFAULT 'Sem título',
  source TEXT NOT NULL DEFAULT 'manual',
  objetivo TEXT,
  blueprint JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"variables":[]}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_blueprints TO authenticated;
GRANT ALL ON public.imphq_flow_blueprints TO service_role;
ALTER TABLE public.imphq_flow_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage flow blueprints"
  ON public.imphq_flow_blueprints FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX idx_flow_blueprints_project ON public.imphq_flow_blueprints(project_id);

CREATE TABLE public.imphq_flow_image_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blueprint_id UUID NOT NULL REFERENCES public.imphq_flow_blueprints(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_image_jobs TO authenticated;
GRANT ALL ON public.imphq_flow_image_jobs TO service_role;
ALTER TABLE public.imphq_flow_image_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage flow image jobs"
  ON public.imphq_flow_image_jobs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX idx_flow_image_jobs_blueprint ON public.imphq_flow_image_jobs(blueprint_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column_flow()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_flow_blueprints_updated
  BEFORE UPDATE ON public.imphq_flow_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_flow();

CREATE TRIGGER trg_flow_image_jobs_updated
  BEFORE UPDATE ON public.imphq_flow_image_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_flow();

ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_flow_image_jobs;
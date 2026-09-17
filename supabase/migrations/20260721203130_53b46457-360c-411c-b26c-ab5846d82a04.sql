CREATE TABLE public.imphq_wa_audience_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  descricao text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_count integer,
  last_previewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_wa_audience_segments TO authenticated;
GRANT ALL ON public.imphq_wa_audience_segments TO service_role;

ALTER TABLE public.imphq_wa_audience_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_segments_owner_all" ON public.imphq_wa_audience_segments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_wa_segments_project ON public.imphq_wa_audience_segments(project_id, updated_at DESC);

CREATE TRIGGER trg_wa_segments_updated
  BEFORE UPDATE ON public.imphq_wa_audience_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
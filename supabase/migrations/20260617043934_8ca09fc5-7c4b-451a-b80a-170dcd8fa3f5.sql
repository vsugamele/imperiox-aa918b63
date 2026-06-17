
CREATE TABLE IF NOT EXISTS public.imphq_flow_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('audio','image','video','doc')),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  duration_ms INT,
  transcript TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_media_project ON public.imphq_flow_media(project_id);
CREATE INDEX IF NOT EXISTS idx_flow_media_kind ON public.imphq_flow_media(kind);
CREATE INDEX IF NOT EXISTS idx_flow_media_created ON public.imphq_flow_media(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_media TO authenticated;
GRANT ALL ON public.imphq_flow_media TO service_role;

ALTER TABLE public.imphq_flow_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view flow media"
  ON public.imphq_flow_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flow media"
  ON public.imphq_flow_media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flow media"
  ON public.imphq_flow_media FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete flow media"
  ON public.imphq_flow_media FOR DELETE TO authenticated USING (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_flow_media_updated_at ON public.imphq_flow_media;
CREATE TRIGGER trg_flow_media_updated_at
  BEFORE UPDATE ON public.imphq_flow_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies do bucket flow-media (o bucket é criado manualmente no dashboard)
CREATE POLICY "Authenticated read flow-media bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'flow-media');
CREATE POLICY "Authenticated upload flow-media bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'flow-media');
CREATE POLICY "Authenticated update flow-media bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'flow-media');
CREATE POLICY "Authenticated delete flow-media bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'flow-media');

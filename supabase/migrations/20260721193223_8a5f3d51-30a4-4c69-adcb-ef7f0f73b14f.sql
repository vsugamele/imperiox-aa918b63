
CREATE TABLE public.imphq_company_map_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL,
  target_id TEXT NOT NULL,
  target_kind TEXT NOT NULL DEFAULT 'node',
  author_id UUID NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  body TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_map_comments_map ON public.imphq_company_map_comments(map_id);
CREATE INDEX idx_map_comments_target ON public.imphq_company_map_comments(map_id, target_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_company_map_comments TO authenticated;
GRANT ALL ON public.imphq_company_map_comments TO service_role;

ALTER TABLE public.imphq_company_map_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read map comments"
  ON public.imphq_company_map_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert map comments"
  ON public.imphq_company_map_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authenticated can update map comments"
  ON public.imphq_company_map_comments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authors can delete their own map comments"
  ON public.imphq_company_map_comments FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_company_map_comments;

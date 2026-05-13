CREATE TABLE IF NOT EXISTS public.imphq_mi_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT,
  mode TEXT NOT NULL,
  query TEXT,
  result_md TEXT,
  intel_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_mi_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own mi searches" ON public.imphq_mi_searches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own mi searches" ON public.imphq_mi_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own mi searches" ON public.imphq_mi_searches
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mi_searches_user_created ON public.imphq_mi_searches (user_id, created_at DESC);
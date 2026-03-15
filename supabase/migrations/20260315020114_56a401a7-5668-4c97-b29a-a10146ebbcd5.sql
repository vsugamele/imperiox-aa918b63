
-- Phase 3: Project Templates
CREATE TABLE public.imphq_project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📋',
  category TEXT DEFAULT 'geral',
  boards_json JSONB NOT NULL DEFAULT '[]',
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.imphq_project_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read templates" ON public.imphq_project_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own templates" ON public.imphq_project_templates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Phase 5: Growth Metrics
CREATE TABLE public.imphq_growth_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  category TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  valor NUMERIC(12,2) DEFAULT 0,
  meta NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, week_start, category, metric_name)
);
ALTER TABLE public.imphq_growth_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage growth metrics" ON public.imphq_growth_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 6: API Keys
CREATE TABLE public.imphq_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_preview TEXT NOT NULL,
  permissions JSONB DEFAULT '["read"]',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.imphq_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own api keys" ON public.imphq_api_keys FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

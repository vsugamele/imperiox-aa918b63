
CREATE TABLE IF NOT EXISTS public.imphq_assistente_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('campanhas','lancamento','nutricao')),
  score INTEGER NOT NULL DEFAULT 0,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  gargalos JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_action TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, area)
);

CREATE INDEX IF NOT EXISTS idx_assistente_diag_project ON public.imphq_assistente_diagnostics(project_id);

ALTER TABLE public.imphq_assistente_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diag_select_own" ON public.imphq_assistente_diagnostics
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.imphq_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE POLICY "diag_modify_own" ON public.imphq_assistente_diagnostics
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.imphq_projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.imphq_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE POLICY "diag_service_role" ON public.imphq_assistente_diagnostics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

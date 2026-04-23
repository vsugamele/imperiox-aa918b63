
CREATE TABLE IF NOT EXISTS public.imphq_project_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_receita NUMERIC NOT NULL DEFAULT 0,
  meta_leads INTEGER NOT NULL DEFAULT 0,
  meta_vendas INTEGER NOT NULL DEFAULT 0,
  meta_roas NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, ano, mes)
);

ALTER TABLE public.imphq_project_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read goals" ON public.imphq_project_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert goals" ON public.imphq_project_goals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update goals" ON public.imphq_project_goals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete goals" ON public.imphq_project_goals FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_goals_project ON public.imphq_project_goals(project_id, ano, mes);

CREATE TABLE IF NOT EXISTS public.imphq_project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  author_id UUID,
  author_name TEXT,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read notes" ON public.imphq_project_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert notes" ON public.imphq_project_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update notes" ON public.imphq_project_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete notes" ON public.imphq_project_notes FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notes_project ON public.imphq_project_notes(project_id, created_at DESC);

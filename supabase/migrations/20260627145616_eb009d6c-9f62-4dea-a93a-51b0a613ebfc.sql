
CREATE TABLE public.imphq_funnel_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  product_id TEXT,
  flow_blueprint_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'outros',
  priority TEXT NOT NULL DEFAULT 'med',
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'todo',
  assigned_to UUID,
  kanban_card_id UUID,
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fcheck_project ON public.imphq_funnel_checklist(project_id);
CREATE INDEX idx_fcheck_product ON public.imphq_funnel_checklist(product_id);
CREATE INDEX idx_fcheck_user ON public.imphq_funnel_checklist(user_id);
CREATE INDEX idx_fcheck_status ON public.imphq_funnel_checklist(status);
CREATE INDEX idx_fcheck_due ON public.imphq_funnel_checklist(due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_funnel_checklist TO authenticated;
GRANT ALL ON public.imphq_funnel_checklist TO service_role;

ALTER TABLE public.imphq_funnel_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checklist"
  ON public.imphq_funnel_checklist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_fcheck_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fcheck_touch
  BEFORE UPDATE ON public.imphq_funnel_checklist
  FOR EACH ROW EXECUTE FUNCTION public.tg_fcheck_touch();

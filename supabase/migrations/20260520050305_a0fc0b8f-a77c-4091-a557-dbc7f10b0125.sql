ALTER TABLE public.imphq_nurture_sequences 
  ADD COLUMN IF NOT EXISTS filter_tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS filter_tags_mode text DEFAULT 'any';

CREATE TABLE IF NOT EXISTS public.imphq_tag_project_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tag text NOT NULL,
  project_id text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tag_project_rules_user_tag ON public.imphq_tag_project_rules(user_id, tag);
CREATE INDEX IF NOT EXISTS idx_tag_project_rules_priority ON public.imphq_tag_project_rules(priority);

ALTER TABLE public.imphq_tag_project_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_rules_select_own" ON public.imphq_tag_project_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tag_rules_insert_own" ON public.imphq_tag_project_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tag_rules_update_own" ON public.imphq_tag_project_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tag_rules_delete_own" ON public.imphq_tag_project_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_tag_project_rules_updated
  BEFORE UPDATE ON public.imphq_tag_project_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
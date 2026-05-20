ALTER TABLE public.imphq_tag_project_rules
  ADD COLUMN IF NOT EXISTS tags_all text[],
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS plataforma text;

CREATE INDEX IF NOT EXISTS idx_imphq_tag_project_rules_tags_all
  ON public.imphq_tag_project_rules USING GIN (tags_all);
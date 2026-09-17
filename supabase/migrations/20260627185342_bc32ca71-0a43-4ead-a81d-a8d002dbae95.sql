
ALTER TABLE public.imphq_wa_project_rules ADD COLUMN IF NOT EXISTS last_applied_at timestamptz;
ALTER TABLE public.imphq_wa_knowledge    ADD COLUMN IF NOT EXISTS last_applied_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_rule_apps_rule_applied
  ON public.imphq_wa_rule_applications (rule_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_rule_apps_project_applied
  ON public.imphq_wa_rule_applications (project_id, applied_at DESC);

CREATE OR REPLACE FUNCTION public.bump_rule_last_applied()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.rule_id IS NOT NULL THEN
    UPDATE public.imphq_wa_project_rules
       SET last_applied_at = COALESCE(NEW.applied_at, now()),
           times_applied   = COALESCE(times_applied, 0) + 1
     WHERE id = NEW.rule_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_rule_last_applied ON public.imphq_wa_rule_applications;
CREATE TRIGGER trg_bump_rule_last_applied
AFTER INSERT ON public.imphq_wa_rule_applications
FOR EACH ROW EXECUTE FUNCTION public.bump_rule_last_applied();

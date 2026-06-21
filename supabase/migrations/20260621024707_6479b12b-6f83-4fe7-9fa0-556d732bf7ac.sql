
CREATE OR REPLACE FUNCTION public.increment_wa_rules_applied(p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.imphq_wa_project_rules
  SET times_applied = times_applied + 1, updated_at = now()
  WHERE id = ANY(p_ids);
$$;

GRANT EXECUTE ON FUNCTION public.increment_wa_rules_applied(uuid[]) TO authenticated, service_role;

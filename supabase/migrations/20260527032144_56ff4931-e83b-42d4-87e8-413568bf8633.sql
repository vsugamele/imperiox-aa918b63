CREATE OR REPLACE FUNCTION public.count_leads_by_project()
RETURNS TABLE(project_id text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(project_id, '__none__') AS project_id, count(*)::bigint AS total
  FROM public.imphq_leads
  GROUP BY COALESCE(project_id, '__none__');
$$;

GRANT EXECUTE ON FUNCTION public.count_leads_by_project() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_leads_by_project() TO service_role;
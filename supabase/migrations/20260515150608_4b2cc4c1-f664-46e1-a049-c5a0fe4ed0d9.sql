
CREATE OR REPLACE FUNCTION public.increment_distributor_click(_dist_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.imphq_wa_group_distributors
     SET click_count = COALESCE(click_count, 0) + 1
   WHERE id = _dist_id;
$$;

CREATE INDEX IF NOT EXISTS idx_distributor_clicks_dist_group
  ON public.imphq_wa_distributor_clicks (distributor_id, group_jid);

CREATE INDEX IF NOT EXISTS idx_distributor_clicks_dist_iphash_created
  ON public.imphq_wa_distributor_clicks (distributor_id, ip_hash, created_at DESC);

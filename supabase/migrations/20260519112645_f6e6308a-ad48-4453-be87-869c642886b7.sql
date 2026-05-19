
CREATE OR REPLACE FUNCTION public.get_unmatched_utm_campaigns(p_days integer DEFAULT 30, p_project_id text DEFAULT NULL)
RETURNS TABLE(
  utm_campaign text,
  eventos bigint,
  vendas bigint,
  project_id text,
  top_produto text,
  first_seen timestamptz,
  already_linked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH src AS (
    SELECT utm_campaign, project_id, NULL::text AS produto, created_at, 'events'::text AS source
      FROM imphq_events
      WHERE utm_campaign IS NOT NULL
        AND created_at > now() - (p_days || ' days')::interval
        AND (p_project_id IS NULL OR project_id = p_project_id)
    UNION ALL
    SELECT utm_campaign, project_id, produto_nome, created_at, 'vendas'
      FROM imphq_vendas
      WHERE utm_campaign IS NOT NULL
        AND created_at > now() - (p_days || ' days')::interval
        AND (p_project_id IS NULL OR project_id = p_project_id)
  ),
  agg AS (
    SELECT
      s.utm_campaign,
      count(*) FILTER (WHERE source='events') AS eventos,
      count(*) FILTER (WHERE source='vendas') AS vendas,
      (SELECT project_id FROM src s2 WHERE s2.utm_campaign = s.utm_campaign GROUP BY project_id ORDER BY count(*) DESC LIMIT 1) AS project_id,
      (SELECT produto FROM src s2 WHERE s2.utm_campaign = s.utm_campaign AND produto IS NOT NULL GROUP BY produto ORDER BY count(*) DESC LIMIT 1) AS top_produto,
      min(s.created_at) AS first_seen
    FROM src s
    GROUP BY s.utm_campaign
  )
  SELECT
    a.utm_campaign,
    a.eventos,
    a.vendas,
    a.project_id,
    a.top_produto,
    a.first_seen,
    EXISTS (SELECT 1 FROM imphq_campanhas c WHERE c.utm_campaign = a.utm_campaign) AS already_linked
  FROM agg a
  ORDER BY (a.eventos + a.vendas * 5) DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.link_leads_by_utm(p_campanha_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_utm text;
  v_project text;
  v_count integer := 0;
BEGIN
  SELECT utm_campaign, project_id INTO v_utm, v_project
    FROM imphq_campanhas WHERE id = p_campanha_id;
  IF v_utm IS NULL THEN
    RETURN 0;
  END IF;

  WITH lead_ids AS (
    SELECT DISTINCT lead_id FROM imphq_vendas
      WHERE utm_campaign = v_utm AND lead_id IS NOT NULL
        AND (v_project IS NULL OR project_id = v_project)
    UNION
    SELECT DISTINCT lead_id FROM imphq_clicks
      WHERE utm_campaign = v_utm AND lead_id IS NOT NULL
        AND (v_project IS NULL OR project_id = v_project)
  )
  UPDATE imphq_leads l
    SET campanha_id = p_campanha_id
    FROM lead_ids li
    WHERE l.id = li.lead_id
      AND (l.campanha_id IS NULL OR l.campanha_id <> p_campanha_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unmatched_utm_campaigns(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_leads_by_utm(uuid) TO authenticated;

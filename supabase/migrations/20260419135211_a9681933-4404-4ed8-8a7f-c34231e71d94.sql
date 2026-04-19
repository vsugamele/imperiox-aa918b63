-- Função que recalcula total_gasto e status de um lead a partir de imphq_vendas
CREATE OR REPLACE FUNCTION public.recalc_lead_total_gasto(p_lead_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_count_aprovadas int;
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(valor), 0),
    COUNT(*)
  INTO v_total, v_count_aprovadas
  FROM public.imphq_vendas
  WHERE lead_id = p_lead_id
    AND LOWER(COALESCE(status, '')) IN ('aprovado','aprovada','approved','paid','pago','completed','complete','succeeded');

  UPDATE public.imphq_leads
  SET
    total_gasto = v_total,
    status = CASE
      WHEN v_count_aprovadas > 0 THEN 'cliente'
      WHEN status = 'cliente' AND v_count_aprovadas = 0 THEN 'lead'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_lead_id;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_sync_lead_total_gasto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_lead_total_gasto(OLD.lead_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalc_lead_total_gasto(NEW.lead_id);
    IF OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
      PERFORM public.recalc_lead_total_gasto(OLD.lead_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recalc_lead_total_gasto(NEW.lead_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_imphq_vendas_sync_lead ON public.imphq_vendas;
CREATE TRIGGER trg_imphq_vendas_sync_lead
AFTER INSERT OR UPDATE OR DELETE ON public.imphq_vendas
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_lead_total_gasto();

-- Backfill: recalcula total_gasto para todos os leads que possuem vendas
WITH agg AS (
  SELECT
    lead_id,
    SUM(valor) FILTER (
      WHERE LOWER(COALESCE(status, '')) IN ('aprovado','aprovada','approved','paid','pago','completed','complete','succeeded')
    ) AS total_aprovado,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(status, '')) IN ('aprovado','aprovada','approved','paid','pago','completed','complete','succeeded')
    ) AS qtd_aprovadas
  FROM public.imphq_vendas
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id
)
UPDATE public.imphq_leads l
SET
  total_gasto = COALESCE(agg.total_aprovado, 0),
  status = CASE
    WHEN COALESCE(agg.qtd_aprovadas, 0) > 0 THEN 'cliente'
    WHEN l.status = 'cliente' AND COALESCE(agg.qtd_aprovadas, 0) = 0 THEN 'lead'
    ELSE l.status
  END,
  updated_at = now()
FROM agg
WHERE l.id = agg.lead_id;
-- Bloco 4.1 — Hardening: adicionar SET search_path em funções imphq sem search_path

CREATE OR REPLACE FUNCTION public.fn_recalc_lead_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(pontos), 0) INTO v_total
  FROM public.imphq_lead_scores_log
  WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  UPDATE public.imphq_leads
  SET score = LEAST(v_total, 100),
      updated_at = NOW()
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recalc_lead_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_total NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(valor), 0)
    INTO v_total
    FROM public.imphq_vendas
   WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
     AND status = 'aprovado';

  UPDATE public.imphq_leads
     SET total_gasto = v_total,
         status      = CASE WHEN v_total > 0 THEN 'cliente' ELSE status END,
         updated_at  = NOW()
   WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);

  RETURN NEW;
END;
$function$;
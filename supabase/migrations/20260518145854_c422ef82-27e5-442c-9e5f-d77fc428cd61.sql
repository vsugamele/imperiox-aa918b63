
CREATE OR REPLACE FUNCTION public.trg_set_lead_campanha_from_form()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_camp_id uuid;
BEGIN
  IF NEW.form_id IS NULL OR NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cf.campanha_id INTO v_camp_id
  FROM public.imphq_campanha_forms cf
  JOIN public.imphq_campanhas c ON c.id = cf.campanha_id
  WHERE cf.form_id = NEW.form_id
    AND c.status = 'ativa'
    AND (cf.vigente_de IS NULL OR cf.vigente_de <= now())
    AND (cf.vigente_ate IS NULL OR cf.vigente_ate >= now())
  ORDER BY cf.vigente_de DESC NULLS LAST
  LIMIT 1;

  IF v_camp_id IS NOT NULL THEN
    UPDATE public.imphq_leads
       SET campanha_id = v_camp_id
     WHERE id = NEW.lead_id
       AND campanha_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_responses_set_campanha ON public.imphq_lead_responses;
CREATE TRIGGER trg_lead_responses_set_campanha
AFTER INSERT ON public.imphq_lead_responses
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_lead_campanha_from_form();

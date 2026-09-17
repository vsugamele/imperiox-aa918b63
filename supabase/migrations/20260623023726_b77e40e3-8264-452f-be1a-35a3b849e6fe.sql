CREATE OR REPLACE FUNCTION public.attribute_venda_to_wa_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.imphq_wa_rule_applications app
     SET converted_at = now(),
         venda_id     = NEW.id::text
   WHERE app.lead_id = NEW.lead_id::text
     AND app.converted_at IS NULL
     AND app.applied_at >= now() - interval '7 days';

  UPDATE public.imphq_wa_project_rules r
     SET conversion_count = conversion_count + 1
   WHERE r.id IN (
     SELECT app.rule_id FROM public.imphq_wa_rule_applications app
      WHERE app.venda_id = NEW.id::text
   );

  RETURN NEW;
END;
$function$;
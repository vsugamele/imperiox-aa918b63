
CREATE TABLE IF NOT EXISTS public.imphq_product_project_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_nome text NOT NULL UNIQUE,
  project_id text NOT NULL,
  override_existing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_product_project_rules TO authenticated;
GRANT ALL ON public.imphq_product_project_rules TO service_role;

ALTER TABLE public.imphq_product_project_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product rules"
  ON public.imphq_product_project_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert product rules"
  ON public.imphq_product_project_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update product rules"
  ON public.imphq_product_project_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete product rules"
  ON public.imphq_product_project_rules FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_imphq_product_project_rules_updated ON public.imphq_product_project_rules;
CREATE TRIGGER trg_imphq_product_project_rules_updated
  BEFORE UPDATE ON public.imphq_product_project_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger em vendas: atribui projeto ao lead quando casar regra
CREATE OR REPLACE FUNCTION public.apply_product_project_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project text;
  v_override boolean;
  v_lead_project text;
BEGIN
  IF NEW.produto_nome IS NULL OR NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT project_id, override_existing
    INTO v_project, v_override
  FROM public.imphq_product_project_rules
  WHERE produto_nome = NEW.produto_nome
  LIMIT 1;

  IF v_project IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT project_id INTO v_lead_project FROM public.imphq_leads WHERE id = NEW.lead_id;

  IF v_lead_project IS NULL OR v_override THEN
    UPDATE public.imphq_leads SET project_id = v_project WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_apply_product_project_rule ON public.imphq_vendas;
CREATE TRIGGER trg_apply_product_project_rule
  AFTER INSERT OR UPDATE OF produto_nome, lead_id ON public.imphq_vendas
  FOR EACH ROW EXECUTE FUNCTION public.apply_product_project_rule();

-- RPC para reaplicar uma regra em todos os leads/vendas existentes
CREATE OR REPLACE FUNCTION public.backfill_product_project_rule(
  p_produto text,
  p_project text,
  p_override boolean DEFAULT false
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH leads_with_product AS (
    SELECT DISTINCT l.id, l.project_id
    FROM public.imphq_leads l
    LEFT JOIN public.imphq_vendas v ON v.lead_id = l.id AND v.produto_nome = p_produto
    WHERE v.id IS NOT NULL
       OR (l.data->>'ultimo_produto') = p_produto
  ), updated AS (
    UPDATE public.imphq_leads l
       SET project_id = p_project
      FROM leads_with_product lwp
     WHERE l.id = lwp.id
       AND (p_override OR lwp.project_id IS NULL)
    RETURNING l.id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END; $$;

GRANT EXECUTE ON FUNCTION public.backfill_product_project_rule(text, text, boolean) TO authenticated;

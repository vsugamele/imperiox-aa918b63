-- 1. Adiciona coluna valor_liquido em imphq_vendas
ALTER TABLE public.imphq_vendas
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC;

-- 2. Função para obter share do produtor (fallback) a partir de imphq_projects.settings
CREATE OR REPLACE FUNCTION public.get_producer_share(_project_id text, _produto_nome text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1) share específico por produto
    NULLIF(((settings->'revenue_splits'->'by_product'->>_produto_nome))::numeric, 0),
    -- 2) share padrão do projeto
    NULLIF(((settings->'revenue_splits'->>'default_share'))::numeric, 0),
    -- 3) sem config → 1.0 (recebe tudo)
    1.0
  )
  FROM public.imphq_projects
  WHERE id = _project_id
  LIMIT 1;
$$;

-- 3. Trigger de cálculo automático de valor_liquido
CREATE OR REPLACE FUNCTION public.imphq_vendas_calc_valor_liquido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comissao numeric;
  v_liquido_plat numeric;
  v_share numeric;
BEGIN
  v_comissao := NULLIF((NEW.data->>'comissao_produtor')::numeric, 0);
  v_liquido_plat := NULLIF((NEW.data->>'valor_liquido')::numeric, 0);

  IF v_comissao IS NOT NULL THEN
    NEW.valor_liquido := v_comissao;
  ELSIF v_liquido_plat IS NOT NULL THEN
    NEW.valor_liquido := v_liquido_plat;
  ELSE
    -- Fallback: aplica share configurado
    v_share := public.get_producer_share(NEW.project_id, NEW.produto_nome);
    NEW.valor_liquido := COALESCE(NEW.valor, 0) * COALESCE(v_share, 1.0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_imphq_vendas_calc_valor_liquido ON public.imphq_vendas;
CREATE TRIGGER trg_imphq_vendas_calc_valor_liquido
BEFORE INSERT OR UPDATE OF valor, data, project_id, produto_nome ON public.imphq_vendas
FOR EACH ROW
EXECUTE FUNCTION public.imphq_vendas_calc_valor_liquido();

-- 4. Backfill de todas as vendas existentes
UPDATE public.imphq_vendas
SET valor_liquido = COALESCE(
  NULLIF((data->>'comissao_produtor')::numeric, 0),
  NULLIF((data->>'valor_liquido')::numeric, 0),
  COALESCE(valor, 0) * COALESCE(public.get_producer_share(project_id, produto_nome), 1.0)
)
WHERE valor_liquido IS NULL;

-- 5. Índice para queries de agregação
CREATE INDEX IF NOT EXISTS idx_imphq_vendas_project_data_valor_liquido
  ON public.imphq_vendas (project_id, data_venda)
  WHERE valor_liquido IS NOT NULL;
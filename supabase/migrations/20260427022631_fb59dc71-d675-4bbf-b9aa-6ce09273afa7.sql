-- ============================================================
-- 1) Coluna external_transaction_id
-- ============================================================
ALTER TABLE public.imphq_vendas
  ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;

-- ============================================================
-- 2) Backfill
-- ============================================================
UPDATE public.imphq_vendas
SET external_transaction_id = NULLIF(data->>'codigo_pedido', '')
WHERE external_transaction_id IS NULL
  AND data ? 'codigo_pedido'
  AND NULLIF(data->>'codigo_pedido', '') IS NOT NULL;

-- ============================================================
-- 3) Normalizar status
-- ============================================================
UPDATE public.imphq_vendas SET status = 'aprovado' WHERE status = 'aprovada';

-- ============================================================
-- 4) Dedup por (project_id, external_transaction_id, produto_nome)
-- Mantém: status com prioridade (chargeback > reembolsado > cancelado > aprovado > pendente),
-- depois payload mais rico, depois mais antigo
-- ============================================================
WITH ranked_tx AS (
  SELECT
    id, lead_id, produto_nome, valor, project_id, created_at, data, status,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, external_transaction_id, produto_nome
      ORDER BY
        (CASE status
          WHEN 'chargeback' THEN 0
          WHEN 'reembolsado' THEN 1
          WHEN 'cancelado' THEN 2
          WHEN 'aprovado' THEN 3
          ELSE 4
        END),
        (CASE WHEN data IS NOT NULL AND jsonb_typeof(data)='object' AND data <> '{}'::jsonb THEN 0 ELSE 1 END),
        created_at ASC,
        id ASC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY project_id, external_transaction_id, produto_nome) AS total
  FROM public.imphq_vendas
  WHERE external_transaction_id IS NOT NULL
    AND project_id IS NOT NULL
),
to_delete_tx AS (
  SELECT * FROM ranked_tx WHERE rn > 1 AND total > 1
),
log_tx AS (
  INSERT INTO public.imphq_events (id, event_name, project_id, visitor_id, page_url, event_data, created_at)
  SELECT
    gen_random_uuid(),
    'VendaDuplicadaRemovida',
    td.project_id,
    td.lead_id,
    'migration://dedup-vendas-tx',
    jsonb_build_object('venda_id', td.id, 'produto_nome', td.produto_nome, 'valor', td.valor, 'status', td.status, 'created_at', td.created_at),
    now()
  FROM to_delete_tx td
  RETURNING 1
)
DELETE FROM public.imphq_vendas v
USING to_delete_tx td
WHERE v.id = td.id;

-- ============================================================
-- 5) Dedup adicional para vendas SEM external_transaction_id
-- (mesmo lead+produto+valor+status nos últimos 180d)
-- ============================================================
WITH ranked_legacy AS (
  SELECT
    id, lead_id, produto_nome, valor, project_id, created_at, data, status,
    ROW_NUMBER() OVER (
      PARTITION BY lead_id, produto_nome, valor, status
      ORDER BY
        (CASE WHEN data IS NOT NULL AND jsonb_typeof(data)='object' AND data <> '{}'::jsonb THEN 0 ELSE 1 END),
        created_at ASC,
        id ASC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY lead_id, produto_nome, valor, status) AS total
  FROM public.imphq_vendas
  WHERE external_transaction_id IS NULL
    AND status = 'aprovado'
    AND created_at > NOW() - INTERVAL '180 days'
    AND lead_id IS NOT NULL
),
to_delete_legacy AS (
  SELECT * FROM ranked_legacy WHERE rn > 1 AND total > 1
),
log_legacy AS (
  INSERT INTO public.imphq_events (id, event_name, project_id, visitor_id, page_url, event_data, created_at)
  SELECT
    gen_random_uuid(),
    'VendaDuplicadaRemovida',
    td.project_id,
    td.lead_id,
    'migration://dedup-vendas-legacy',
    jsonb_build_object('venda_id', td.id, 'produto_nome', td.produto_nome, 'valor', td.valor, 'status', td.status, 'created_at', td.created_at),
    now()
  FROM to_delete_legacy td
  RETURNING 1
)
DELETE FROM public.imphq_vendas v
USING to_delete_legacy td
WHERE v.id = td.id;

-- ============================================================
-- 6) Recalcular total_gasto
-- ============================================================
UPDATE public.imphq_leads l
SET total_gasto = COALESCE(s.total, 0),
    updated_at = now()
FROM (
  SELECT lead_id, SUM(valor) AS total
  FROM public.imphq_vendas
  WHERE status = 'aprovado'
  GROUP BY lead_id
) s
WHERE l.id = s.lead_id
  AND COALESCE(l.total_gasto, 0) <> COALESCE(s.total, 0);

-- ============================================================
-- 7) Índice UNIQUE
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS imphq_vendas_project_tx_produto_uniq
  ON public.imphq_vendas (project_id, external_transaction_id, produto_nome)
  WHERE external_transaction_id IS NOT NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS imphq_vendas_external_tx_idx
  ON public.imphq_vendas (external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;


ALTER TABLE public.imphq_vendas ADD COLUMN IF NOT EXISTS pais TEXT;
CREATE INDEX IF NOT EXISTS idx_imphq_vendas_pais ON public.imphq_vendas(pais);

-- Backfill from JSONB metadata
UPDATE public.imphq_vendas
SET pais = UPPER(COALESCE(
  data->>'pais_comprador',
  data->'buyer'->>'country_iso',
  data->'buyer'->>'country',
  data->'buyer'->'address'->>'country',
  CASE data->>'moeda_original'
    WHEN 'BRL' THEN 'BR'
    WHEN 'PYG' THEN 'PY'
    WHEN 'USD' THEN 'US'
    WHEN 'EUR' THEN 'EU'
    WHEN 'ARS' THEN 'AR'
    WHEN 'CLP' THEN 'CL'
    WHEN 'COP' THEN 'CO'
    WHEN 'MXN' THEN 'MX'
    WHEN 'PEN' THEN 'PE'
    WHEN 'UYU' THEN 'UY'
    WHEN 'GBP' THEN 'GB'
    ELSE NULL
  END
))
WHERE pais IS NULL;

-- Default any remaining to BR (Hotmart default for BRL sales without country tag)
UPDATE public.imphq_vendas SET pais = 'BR' WHERE pais IS NULL;

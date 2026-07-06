
CREATE TABLE IF NOT EXISTS public.imphq_webhook_dedup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  event_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS imphq_webhook_dedup_processed_at_idx
  ON public.imphq_webhook_dedup (processed_at DESC);

GRANT ALL ON public.imphq_webhook_dedup TO service_role;

ALTER TABLE public.imphq_webhook_dedup ENABLE ROW LEVEL SECURITY;

-- Sem policies → só service_role acessa (via edge functions). Nenhum acesso do frontend.

-- TTL: purga registros > 30 dias
CREATE OR REPLACE FUNCTION public.purge_old_webhook_dedup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.imphq_webhook_dedup WHERE processed_at < now() - interval '30 days';
$$;


-- Dedup de eventos Zernio
CREATE TABLE IF NOT EXISTS public.imphq_zernio_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  project_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

GRANT ALL ON public.imphq_zernio_webhook_events TO service_role;
ALTER TABLE public.imphq_zernio_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access zernio_webhook_events"
  ON public.imphq_zernio_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_zernio_webhook_events_received_at
  ON public.imphq_zernio_webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_zernio_webhook_events_type
  ON public.imphq_zernio_webhook_events (event_type);

-- Contexto de ad em comentários IG
ALTER TABLE public.imphq_ig_comments
  ADD COLUMN IF NOT EXISTS ad_context jsonb;

-- Índice único em comment_id para upsert idempotente
CREATE UNIQUE INDEX IF NOT EXISTS idx_imphq_ig_comments_comment_id_unique
  ON public.imphq_ig_comments (comment_id);

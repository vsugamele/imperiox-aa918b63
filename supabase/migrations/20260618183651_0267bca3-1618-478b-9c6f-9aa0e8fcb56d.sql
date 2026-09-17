
-- Tabela de webhooks de saída (configuração)
CREATE TABLE public.imphq_outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  last_status TEXT,
  total_deliveries INT NOT NULL DEFAULT 0,
  total_failures INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_outbound_webhooks TO authenticated;
GRANT ALL ON public.imphq_outbound_webhooks TO service_role;
ALTER TABLE public.imphq_outbound_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own outbound webhooks"
  ON public.imphq_outbound_webhooks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_outbound_webhooks_events ON public.imphq_outbound_webhooks USING GIN (events) WHERE active = true;
CREATE INDEX idx_outbound_webhooks_project ON public.imphq_outbound_webhooks(project_id) WHERE active = true;

-- Tabela de entregas (log + fila de retry)
CREATE TABLE public.imphq_outbound_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.imphq_outbound_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed | retrying
  status_code INT,
  response_body TEXT,
  error_message TEXT,
  attempt INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_outbound_webhook_deliveries TO authenticated;
GRANT ALL ON public.imphq_outbound_webhook_deliveries TO service_role;
ALTER TABLE public.imphq_outbound_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own webhook deliveries"
  ON public.imphq_outbound_webhook_deliveries FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.imphq_outbound_webhooks w
    WHERE w.id = webhook_id AND w.user_id = auth.uid()
  ));

CREATE INDEX idx_deliveries_webhook ON public.imphq_outbound_webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_deliveries_retry ON public.imphq_outbound_webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_outbound_webhook_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_outbound_webhooks_updated
  BEFORE UPDATE ON public.imphq_outbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_outbound_webhook_updated_at();

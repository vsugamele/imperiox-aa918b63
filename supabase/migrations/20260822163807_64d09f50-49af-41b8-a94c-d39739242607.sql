CREATE TABLE public.imphq_flow_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text,
  automacao_id uuid,
  nome text NOT NULL DEFAULT 'Webhook de entrada',
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  evento text,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  total_recebidos integer NOT NULL DEFAULT 0,
  last_payload jsonb,
  last_received_at timestamptz,
  last_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_webhooks TO authenticated;
GRANT ALL ON public.imphq_flow_webhooks TO service_role;

ALTER TABLE public.imphq_flow_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth manage flow webhooks" ON public.imphq_flow_webhooks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_flow_webhooks_token ON public.imphq_flow_webhooks(token);
CREATE INDEX idx_flow_webhooks_project ON public.imphq_flow_webhooks(project_id);
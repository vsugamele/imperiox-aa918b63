
ALTER TABLE public.imphq_automacoes
  ADD COLUMN IF NOT EXISTS rate_limit_per_lead_24h integer,
  ADD COLUMN IF NOT EXISTS circuit_breaker_error_pct integer,
  ADD COLUMN IF NOT EXISTS circuit_breaker_window_min integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS circuit_breaker_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS circuit_breaker_reason text,
  ADD COLUMN IF NOT EXISTS linked_blueprint_id uuid REFERENCES public.imphq_flow_blueprints(id) ON DELETE SET NULL;

ALTER TABLE public.imphq_flow_blueprints
  ADD COLUMN IF NOT EXISTS linked_automacao_id text;

CREATE INDEX IF NOT EXISTS idx_automacoes_linked_blueprint ON public.imphq_automacoes(linked_blueprint_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_linked_automacao ON public.imphq_flow_blueprints(linked_automacao_id);

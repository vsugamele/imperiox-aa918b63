ALTER TABLE public.imphq_wa_providers
  ADD COLUMN IF NOT EXISTS health_alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS health_alerts_muted_until timestamptz;
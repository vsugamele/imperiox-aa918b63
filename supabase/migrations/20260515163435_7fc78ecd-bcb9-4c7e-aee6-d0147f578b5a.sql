-- Add rotation columns to distributors
ALTER TABLE public.imphq_wa_group_distributors
  ADD COLUMN IF NOT EXISTS rotation_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS rotation_cron TEXT,
  ADD COLUMN IF NOT EXISTS current_week INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_rotation_at TIMESTAMPTZ;

-- Weeks table
CREATE TABLE IF NOT EXISTS public.imphq_wa_distributor_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES public.imphq_wa_group_distributors(id) ON DELETE CASCADE,
  week_index INTEGER NOT NULL,
  group_jid TEXT NOT NULL,
  invite_url TEXT,
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, week_index)
);
CREATE INDEX IF NOT EXISTS idx_dist_weeks_distributor ON public.imphq_wa_distributor_weeks(distributor_id, week_index);
CREATE INDEX IF NOT EXISTS idx_dist_weeks_active ON public.imphq_wa_distributor_weeks(distributor_id) WHERE archived_at IS NULL;

ALTER TABLE public.imphq_wa_distributor_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage distributor weeks"
  ON public.imphq_wa_distributor_weeks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Cohorts table
CREATE TABLE IF NOT EXISTS public.imphq_wa_distributor_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES public.imphq_wa_group_distributors(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  week_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, ip_hash)
);
CREATE INDEX IF NOT EXISTS idx_dist_cohorts_lookup ON public.imphq_wa_distributor_cohorts(distributor_id, ip_hash);

ALTER TABLE public.imphq_wa_distributor_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cohorts"
  ON public.imphq_wa_distributor_cohorts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages cohorts"
  ON public.imphq_wa_distributor_cohorts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.imphq_wa_conversations ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conv_snoozed ON public.imphq_wa_conversations(snoozed_until) WHERE snoozed_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.imphq_wa_scheduled (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NULL,
  project_id TEXT NULL,
  provider_id UUID NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT NULL,
  media_type TEXT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ NULL,
  error TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_sched_due ON public.imphq_wa_scheduled(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wa_sched_conv ON public.imphq_wa_scheduled(conversation_id, scheduled_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_wa_scheduled TO authenticated;
GRANT ALL ON public.imphq_wa_scheduled TO service_role;

ALTER TABLE public.imphq_wa_scheduled ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sched" ON public.imphq_wa_scheduled FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert sched" ON public.imphq_wa_scheduled FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update own sched" ON public.imphq_wa_scheduled FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete sched" ON public.imphq_wa_scheduled FOR DELETE TO authenticated USING (true);

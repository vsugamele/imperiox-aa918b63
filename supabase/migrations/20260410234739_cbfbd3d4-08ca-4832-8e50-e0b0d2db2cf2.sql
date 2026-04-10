
-- 1. Add send_date to campaign steps
ALTER TABLE public.imphq_wa_campaign_steps
ADD COLUMN IF NOT EXISTS send_date DATE;

-- 2. Add exit_message to campaigns
ALTER TABLE public.imphq_wa_campaigns
ADD COLUMN IF NOT EXISTS exit_message TEXT;

-- 3. Group exits tracking
CREATE TABLE IF NOT EXISTS public.imphq_wa_group_exits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.imphq_wa_campaigns(id) ON DELETE SET NULL,
  group_jid TEXT NOT NULL,
  phone TEXT NOT NULL,
  exited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_sent BOOLEAN NOT NULL DEFAULT false,
  provider_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_group_exits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage group exits"
  ON public.imphq_wa_group_exits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Commands table
CREATE TABLE IF NOT EXISTS public.imphq_wa_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  trigger_word TEXT NOT NULL,
  response_text TEXT,
  response_media_url TEXT,
  media_type TEXT DEFAULT 'text',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_wa_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage commands"
  ON public.imphq_wa_commands FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_imphq_wa_commands_updated_at
  BEFORE UPDATE ON public.imphq_wa_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. CRM table
CREATE TABLE IF NOT EXISTS public.imphq_wa_crm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  stage TEXT NOT NULL DEFAULT 'lead',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  value NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

ALTER TABLE public.imphq_wa_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage CRM"
  ON public.imphq_wa_crm FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_imphq_wa_crm_updated_at
  BEFORE UPDATE ON public.imphq_wa_crm
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

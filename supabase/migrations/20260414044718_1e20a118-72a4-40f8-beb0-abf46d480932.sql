CREATE TABLE IF NOT EXISTS public.imphq_wa_ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  personality TEXT DEFAULT 'assistente',
  tone TEXT DEFAULT 'profissional',
  max_tokens INTEGER DEFAULT 300,
  escalation_keywords TEXT[] DEFAULT ARRAY['humano', 'atendente', 'pessoa', 'falar com alguém'],
  welcome_message TEXT DEFAULT '',
  context_sources TEXT[] DEFAULT ARRAY['briefing', 'avatar', 'produtos', 'faq'],
  response_delay_seconds INTEGER DEFAULT 3,
  business_hours_only BOOLEAN DEFAULT false,
  business_hours_start TEXT DEFAULT '08:00',
  business_hours_end TEXT DEFAULT '20:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.imphq_wa_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_access" ON public.imphq_wa_ai_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sessions
CREATE TABLE public.imphq_webinar_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.imphq_projects(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  checkout_url TEXT NOT NULL DEFAULT '',
  pitch_label TEXT DEFAULT 'Quero participar',
  reminder_template JSONB DEFAULT '[]'::jsonb,
  recovery_template JSONB DEFAULT '[
    {"delay_minutes": 15, "message": "Oi [NOME]! Vi que você clicou no botão durante a aula mas não finalizou. Posso te ajudar com algo?"},
    {"delay_minutes": 60, "message": "[NOME], as vagas com o bônus de hoje fecham em breve. Quer que eu te envie o link de novo?"},
    {"delay_minutes": 1440, "message": "[NOME], última chamada — depois disso o preço volta ao normal. Bora garantir?"}
  ]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webinar_sessions_project ON public.imphq_webinar_sessions(project_id);

-- Registrations
CREATE TABLE public.imphq_webinar_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.imphq_webinar_sessions(id) ON DELETE CASCADE,
  lead_id TEXT,
  nome TEXT,
  email TEXT,
  phone TEXT,
  lead_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  status TEXT NOT NULL DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webinar_reg_session ON public.imphq_webinar_registrations(session_id);
CREATE INDEX idx_webinar_reg_email ON public.imphq_webinar_registrations(email);
CREATE INDEX idx_webinar_reg_phone ON public.imphq_webinar_registrations(phone);

-- Clicks
CREATE TABLE public.imphq_webinar_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.imphq_webinar_registrations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.imphq_webinar_sessions(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recovered_at TIMESTAMPTZ,
  sale_id TEXT,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX idx_webinar_clicks_session ON public.imphq_webinar_clicks(session_id);
CREATE INDEX idx_webinar_clicks_reg ON public.imphq_webinar_clicks(registration_id);

-- WA queue
CREATE TABLE public.imphq_webinar_wa_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  click_id UUID NOT NULL REFERENCES public.imphq_webinar_clicks(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.imphq_webinar_sessions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webinar_queue_pending ON public.imphq_webinar_wa_queue(status, send_at) WHERE status = 'pending';

-- updated_at triggers
CREATE TRIGGER trg_webinar_sessions_updated BEFORE UPDATE ON public.imphq_webinar_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_webinar_reg_updated BEFORE UPDATE ON public.imphq_webinar_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.imphq_webinar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_webinar_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_webinar_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_webinar_wa_queue ENABLE ROW LEVEL SECURITY;

-- Sessions: dono do projeto
CREATE POLICY "owner all sessions" ON public.imphq_webinar_sessions FOR ALL
  USING (project_id IN (SELECT id FROM public.imphq_projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.imphq_projects WHERE user_id = auth.uid()));

-- Registrations: dono vê tudo da session
CREATE POLICY "owner all regs" ON public.imphq_webinar_registrations FOR ALL
  USING (session_id IN (SELECT id FROM public.imphq_webinar_sessions WHERE project_id IN (SELECT id FROM public.imphq_projects WHERE user_id = auth.uid())))
  WITH CHECK (session_id IN (SELECT id FROM public.imphq_webinar_sessions WHERE project_id IN (SELECT id FROM public.imphq_projects WHERE user_id = auth.uid())));

-- Inscrição pública
CREATE POLICY "public can register" ON public.imphq_webinar_registrations FOR INSERT
  TO anon WITH CHECK (true);

-- Clicks: dono lê
CREATE POLICY "owner read clicks" ON public.imphq_webinar_clicks FOR SELECT
  USING (session_id IN (SELECT id FROM public.imphq_webinar_sessions WHERE project_id IN (SELECT id FROM public.imphq_projects WHERE user_id = auth.uid())));

-- WA queue: dono lê
CREATE POLICY "owner read queue" ON public.imphq_webinar_wa_queue FOR SELECT
  USING (project_id IN (SELECT id FROM public.imphq_projects WHERE user_id = auth.uid()));

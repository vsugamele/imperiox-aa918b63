ALTER TABLE public.imphq_automacoes ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'whatsapp';

CREATE TABLE IF NOT EXISTS public.imphq_channel_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  canal TEXT NOT NULL DEFAULT 'webchat',
  external_id TEXT NOT NULL,
  lead_id TEXT,
  nome TEXT,
  avatar_url TEXT,
  origin TEXT,
  widget_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS imphq_channel_sessions_uniq ON public.imphq_channel_sessions (canal, external_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_channel_sessions TO authenticated;
GRANT ALL ON public.imphq_channel_sessions TO service_role;
ALTER TABLE public.imphq_channel_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage channel sessions" ON public.imphq_channel_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.imphq_channel_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.imphq_channel_sessions(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'in',
  texto TEXT,
  media_url TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS imphq_channel_messages_session_idx ON public.imphq_channel_messages (session_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_channel_messages TO authenticated;
GRANT ALL ON public.imphq_channel_messages TO service_role;
ALTER TABLE public.imphq_channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage channel messages" ON public.imphq_channel_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.imphq_webchat_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  public_key TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  nome TEXT NOT NULL DEFAULT 'Chat do site',
  cor TEXT NOT NULL DEFAULT '#c9922a',
  saudacao TEXT NOT NULL DEFAULT 'Olá! Como podemos ajudar?',
  titulo TEXT NOT NULL DEFAULT 'Fale com a gente',
  automacao_id UUID,
  allowed_origins TEXT[] NOT NULL DEFAULT '{}'::text[],
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_webchat_widgets TO authenticated;
GRANT ALL ON public.imphq_webchat_widgets TO service_role;
ALTER TABLE public.imphq_webchat_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage webchat widgets" ON public.imphq_webchat_widgets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_channel_sessions_updated BEFORE UPDATE ON public.imphq_channel_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_webchat_widgets_updated BEFORE UPDATE ON public.imphq_webchat_widgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
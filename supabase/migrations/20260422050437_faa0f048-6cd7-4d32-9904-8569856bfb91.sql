CREATE TABLE public.imphq_nurture_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  produto_nome TEXT NOT NULL,
  nome TEXT NOT NULL,
  objetivo TEXT,
  duracao_dias INTEGER NOT NULL DEFAULT 365,
  cadencia TEXT NOT NULL DEFAULT 'diaria' CHECK (cadencia IN ('diaria','semanal','quinzenal','custom')),
  cadencia_custom_dias INTEGER[],
  tom_mente_id UUID,
  modelo_ia TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ativa BOOLEAN NOT NULL DEFAULT true,
  total_leads_ativos INTEGER NOT NULL DEFAULT 0,
  total_emails_enviados INTEGER NOT NULL DEFAULT 0,
  total_conversoes INTEGER NOT NULL DEFAULT 0,
  receita_atribuida NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nurture_seq_project ON public.imphq_nurture_sequences(project_id);
CREATE INDEX idx_nurture_seq_produto ON public.imphq_nurture_sequences(produto_nome) WHERE ativa = true;

CREATE TABLE public.imphq_lead_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  sequence_id UUID NOT NULL REFERENCES public.imphq_nurture_sequences(id) ON DELETE CASCADE,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','convertido','unsubscribed','cold','concluido')),
  dia_atual INTEGER NOT NULL DEFAULT 0,
  ultimo_envio_em TIMESTAMPTZ,
  proximo_envio_em TIMESTAMPTZ,
  dias_sem_abertura INTEGER NOT NULL DEFAULT 0,
  cadencia_atual TEXT,
  pausado_em TIMESTAMPTZ,
  pausado_motivo TEXT,
  convertido_em TIMESTAMPTZ,
  receita_gerada NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, sequence_id)
);
CREATE INDEX idx_enroll_lead ON public.imphq_lead_sequence_enrollments(lead_id);
CREATE INDEX idx_enroll_seq ON public.imphq_lead_sequence_enrollments(sequence_id);
CREATE INDEX idx_enroll_proximo ON public.imphq_lead_sequence_enrollments(proximo_envio_em) WHERE status = 'ativo';
CREATE INDEX idx_enroll_status ON public.imphq_lead_sequence_enrollments(status);

CREATE TABLE public.imphq_nurture_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.imphq_lead_sequence_enrollments(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL,
  sequence_id UUID NOT NULL REFERENCES public.imphq_nurture_sequences(id) ON DELETE CASCADE,
  dia_numero INTEGER NOT NULL,
  estagio TEXT,
  assunto TEXT NOT NULL,
  corpo_html TEXT NOT NULL,
  corpo_texto TEXT,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','enviado','pulado','falha','aberto','clicado','convertido')),
  agendado_para TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  aberto_em TIMESTAMPTZ,
  clicado_em TIMESTAMPTZ,
  resend_id TEXT,
  erro TEXT,
  gerado_por_ia BOOLEAN NOT NULL DEFAULT true,
  modelo_ia TEXT,
  contexto_usado JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nurture_emails_enrollment ON public.imphq_nurture_emails(enrollment_id);
CREATE INDEX idx_nurture_emails_lead ON public.imphq_nurture_emails(lead_id);
CREATE INDEX idx_nurture_emails_status ON public.imphq_nurture_emails(status);
CREATE INDEX idx_nurture_emails_agendado ON public.imphq_nurture_emails(agendado_para) WHERE status = 'agendado';

ALTER TABLE public.imphq_nurture_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_lead_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_nurture_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage nurture sequences" ON public.imphq_nurture_sequences FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users manage enrollments" ON public.imphq_lead_sequence_enrollments FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users manage nurture emails" ON public.imphq_nurture_emails FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Service role manages nurture sequences" ON public.imphq_nurture_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages enrollments" ON public.imphq_lead_sequence_enrollments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages nurture emails" ON public.imphq_nurture_emails FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_nurture_seq_updated BEFORE UPDATE ON public.imphq_nurture_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_enroll_updated BEFORE UPDATE ON public.imphq_lead_sequence_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fn_mark_nurture_converted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'aprovado' OR NEW.lead_id IS NULL OR NEW.produto_nome IS NULL THEN RETURN NEW; END IF;
  UPDATE public.imphq_lead_sequence_enrollments e
  SET status = 'convertido', convertido_em = now(),
      receita_gerada = COALESCE(receita_gerada, 0) + COALESCE(NEW.valor, 0),
      updated_at = now()
  FROM public.imphq_nurture_sequences s
  WHERE e.sequence_id = s.id AND e.lead_id = NEW.lead_id
    AND s.produto_nome = NEW.produto_nome AND e.status = 'ativo';
  UPDATE public.imphq_nurture_sequences s
  SET total_conversoes = total_conversoes + 1,
      receita_atribuida = receita_atribuida + COALESCE(NEW.valor, 0),
      updated_at = now()
  WHERE s.produto_nome = NEW.produto_nome AND s.ativa = true;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mark_nurture_converted AFTER INSERT OR UPDATE OF status ON public.imphq_vendas
FOR EACH ROW EXECUTE FUNCTION public.fn_mark_nurture_converted();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'nurture-scheduler-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/nurture-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  ) as request_id;
  $$
);
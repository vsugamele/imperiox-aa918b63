
ALTER TABLE public.imphq_automacoes
  ADD COLUMN IF NOT EXISTS quiet_start smallint,
  ADD COLUMN IF NOT EXISTS quiet_end smallint,
  ADD COLUMN IF NOT EXISTS dedupe_hours integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.imphq_flow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  trigger_tipo text NOT NULL,
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  icon text,
  ordem integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_flow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Templates legíveis para autenticados" ON public.imphq_flow_templates;
CREATE POLICY "Templates legíveis para autenticados"
  ON public.imphq_flow_templates FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.imphq_flow_templates (slug, nome, descricao, trigger_tipo, icon, ordem, acoes) VALUES
  ('pix-recusado-recovery', 'Recuperação de Pagamento Recusado', 'Quando o cartão é recusado, oferece Pix em 5 minutos.', 'pagamento_recusado', '❌', 10,
    '[
      {"tipo":"whatsapp","delay_min":5,"template":"Oi {{nome}}! Vi que o pagamento de *{{produto}}* não foi aprovado. Quer que eu te envie um link em Pix? É mais rápido e sem complicação 👇\n{{link}}"},
      {"tipo":"whatsapp","delay_min":1440,"template":"{{nome}}, só passando pra confirmar — ainda quer levar *{{produto}}*? Se sim, o link em Pix segue aqui: {{link}}"}
    ]'::jsonb),
  ('boleto-vencendo', 'Boleto - Lembrete D-1', 'Quando boleto é gerado, lembra no dia seguinte do vencimento.', 'boleto_gerado', '📄', 20,
    '[
      {"tipo":"whatsapp","delay_min":10,"template":"Oi {{nome}}, seu boleto de *{{produto}}* foi gerado ✅\nVencimento amanhã. Pra pagar agora: {{link}}"},
      {"tipo":"whatsapp","delay_min":1440,"template":"{{nome}}, lembrete: seu boleto de *{{produto}}* vence hoje! Pra evitar perder o acesso, pague aqui: {{link}}"}
    ]'::jsonb),
  ('chargeback-alerta', 'Chargeback - Alerta Interno', 'Notifica equipe e bloqueia acesso quando há chargeback.', 'chargeback', '⚠️', 30,
    '[
      {"tipo":"telegram","delay_min":0,"template":"⚠️ CHARGEBACK detectado\nLead: {{nome}} ({{email}})\nProduto: {{produto}}\nValor: R$ {{valor}}\n\nAção: revisar e bloquear acesso."}
    ]'::jsonb),
  ('pix-expirado-2via', 'Pix Expirou - Segunda Via', 'Reengaja quando o Pix expira sem pagamento.', 'pagamento_expirado', '⌛', 40,
    '[
      {"tipo":"whatsapp","delay_min":15,"template":"Oi {{nome}}, seu Pix de *{{produto}}* expirou ⏳\nGerei um novo link pra você: {{link}}"},
      {"tipo":"whatsapp","delay_min":2880,"template":"{{nome}}, última chance de garantir *{{produto}}* pelo mesmo valor 👇\n{{link}}"}
    ]'::jsonb),
  ('primeiro-acesso-boasvindas', 'Primeiro Acesso - Boas-vindas', 'Onboarding após login inicial na área de membros.', 'primeiro_acesso', '🎉', 50,
    '[
      {"tipo":"whatsapp","delay_min":0,"template":"Olá {{nome}}! Seja muito bem-vindo(a) ao *{{produto}}* 🎉\nQualquer dúvida, é só responder aqui."}
    ]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

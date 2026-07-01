
CREATE TABLE IF NOT EXISTS public.imphq_copy_engine_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text NOT NULL UNIQUE,
  label text NOT NULL,
  system_prompt text NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  reasoning text NOT NULL DEFAULT 'medium',
  output_format text NOT NULL DEFAULT 'text',
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_copy_engine_prompts TO authenticated;
GRANT ALL ON public.imphq_copy_engine_prompts TO service_role;

ALTER TABLE public.imphq_copy_engine_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read copy engine prompts"
ON public.imphq_copy_engine_prompts FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage copy engine prompts"
ON public.imphq_copy_engine_prompts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.imphq_user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin' AND COALESCE(r.status,'approved') = 'approved'))
WITH CHECK (EXISTS (SELECT 1 FROM public.imphq_user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin' AND COALESCE(r.status,'approved') = 'approved'));

CREATE OR REPLACE FUNCTION public.tg_copy_engine_prompts_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_copy_engine_prompts_touch ON public.imphq_copy_engine_prompts;
CREATE TRIGGER trg_copy_engine_prompts_touch
BEFORE UPDATE ON public.imphq_copy_engine_prompts
FOR EACH ROW EXECUTE FUNCTION public.tg_copy_engine_prompts_touch();

ALTER TABLE public.imphq_copilot_threads
  ADD COLUMN IF NOT EXISTS intent text NOT NULL DEFAULT 'chat';
CREATE INDEX IF NOT EXISTS idx_copilot_threads_intent ON public.imphq_copilot_threads(intent);

INSERT INTO public.imphq_copy_engine_prompts (intent, label, system_prompt, model, reasoning, output_format)
VALUES
  ('chat','Chat Imperius','Você é Imperius, copywriter estratégico pt-BR do Império HQ. Tom direto, sem floreios. Consulte sempre Avatar/Branding/Produto antes de gerar. Priorize projetos "Vendendo".','google/gemini-2.5-flash','medium','text'),
  ('campanha_wa','Campanha WhatsApp','Especialista em copy para WhatsApp pt-BR. Mensagens curtas (máx 4 linhas), 1 ideia por mensagem, no máximo 1-2 emojis. Termine com CTA ou pergunta clara.','google/gemini-2.5-flash','low','text'),
  ('email_nutricao','Email de Nutrição','Copywriter de email pt-BR. Assunto curto (<50 chars), abertura que paga a promessa, 1 CTA principal claro. Parágrafos curtos.','google/gemini-2.5-flash','medium','text'),
  ('post_ig','Post Instagram','Copywriter de Instagram pt-BR. Gancho forte na primeira linha, sem hashtags no corpo, formatação escaneável. Final com CTA ou pergunta.','google/gemini-2.5-flash','low','text'),
  ('swipe_variation','Variação de Swipe','Adapta copy mantendo a fórmula original (gancho/participação ativa/narrativa/reframe/CTA engajamento/CTA venda). Devolve JSON válido.','google/gemini-3-flash-preview','medium','json'),
  ('calendario','Calendário de Conteúdo','Planeja calendário editorial alinhado ao objetivo do projeto. Mistura aquisição, ativação e venda. Devolve JSON estruturado.','google/gemini-2.5-flash','medium','json'),
  ('lancamento','Plano de Lançamento','Estrategista de lançamento (Yoshitani/Brunson). Plano D-X até D+0. Tom executivo direto. Reasoning alto.','google/gemini-2.5-pro','high','text'),
  ('vsl','Roteiro VSL','Copywriter de VSL pt-BR. Estrutura: gancho, problema, agitação, solução, prova, oferta, urgência, CTA. Pacing forte.','google/gemini-2.5-pro','high','text'),
  ('studio','Studio (visual)','Gera prompts para produção visual (imagem/vídeo). Detalhe câmera, luz, mood, paleta. Devolve JSON com campos do pipeline Studio.','google/gemini-2.5-flash','medium','json')
ON CONFLICT (intent) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_lead_360(p_lead_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead jsonb;
  v_email text;
  v_phone text;
  v_visitor text;
  v_timeline jsonb;
BEGIN
  SELECT to_jsonb(l.*), l.email, l.phone, COALESCE(l.data->>'visitor_id','')
    INTO v_lead, v_email, v_phone, v_visitor
  FROM public.imphq_leads l WHERE l.id::text = p_lead_id;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('lead', null, 'timeline', '[]'::jsonb);
  END IF;

  WITH events AS (
    SELECT 'click'::text AS kind, c.created_at AS at,
           jsonb_build_object('utm_source',c.utm_source,'utm_campaign',c.utm_campaign,'page_url',c.page_url) AS data
    FROM public.imphq_clicks c
    WHERE (v_email <> '' AND c.email = v_email)
       OR (v_visitor <> '' AND c.visitor_id = v_visitor)
    UNION ALL
    SELECT 'event', e.created_at,
           jsonb_build_object('event_type',e.event_type,'page_url',e.page_url,'meta',e.meta)
    FROM public.imphq_events e
    WHERE (v_visitor <> '' AND e.visitor_id = v_visitor)
       OR (v_email <> '' AND e.email = v_email)
    UNION ALL
    SELECT 'form_response', r.created_at,
           jsonb_build_object('form_id',r.form_id,'respostas',r.respostas)
    FROM public.imphq_lead_responses r
    WHERE r.lead_id::text = p_lead_id
    UNION ALL
    SELECT 'wa_message', m.created_at,
           jsonb_build_object('from_me',m.from_me,'body',LEFT(COALESCE(m.body,''),300),'message_type',m.message_type)
    FROM public.imphq_wa_messages m
    WHERE v_phone <> '' AND m.phone = v_phone
    UNION ALL
    SELECT 'venda', v.created_at,
           jsonb_build_object('produto',v.produto,'valor',v.valor,'status',v.status,'plataforma',v.plataforma)
    FROM public.imphq_vendas v
    WHERE v.lead_id::text = p_lead_id OR (v_email <> '' AND v.email = v_email)
    UNION ALL
    SELECT 'ai_action', a.created_at,
           jsonb_build_object('action_type',a.action_type,'status',a.status,'summary',a.summary)
    FROM public.imphq_ai_actions a
    WHERE a.lead_id::text = p_lead_id
    UNION ALL
    SELECT 'prediction', p.created_at,
           jsonb_build_object('score',p.score,'reasoning',p.reasoning,'next_action',p.next_action)
    FROM public.imphq_lead_predictions p
    WHERE p.lead_id::text = p_lead_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',kind,'at',at,'data',data) ORDER BY at DESC), '[]'::jsonb)
    INTO v_timeline FROM events;

  RETURN jsonb_build_object('lead', v_lead, 'timeline', v_timeline);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('lead', v_lead, 'timeline', '[]'::jsonb, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.get_lead_360(text) TO authenticated, service_role;

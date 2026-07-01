-- 1. Funnel Templates
CREATE TABLE IF NOT EXISTS public.imphq_funnel_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  nicho text,
  objetivo text NOT NULL,
  descricao text,
  thumb_url text,
  canvas jsonb NOT NULL DEFAULT '{}'::jsonb,
  autor text DEFAULT 'Imperius',
  uses_count integer NOT NULL DEFAULT 0,
  is_official boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_funnel_templates TO authenticated;
GRANT ALL ON public.imphq_funnel_templates TO service_role;

ALTER TABLE public.imphq_funnel_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read templates" ON public.imphq_funnel_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write templates" ON public.imphq_funnel_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update templates" ON public.imphq_funnel_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete templates" ON public.imphq_funnel_templates
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_funnel_templates_updated_at
  BEFORE UPDATE ON public.imphq_funnel_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Funnel Snapshots (versionamento do canvas)
CREATE TABLE IF NOT EXISTS public.imphq_funnel_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text NOT NULL,
  produto_id text,
  funil_id text,
  label text,
  motivo text NOT NULL DEFAULT 'manual',
  canvas jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_snapshots_projeto ON public.imphq_funnel_snapshots(projeto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_snapshots_funil ON public.imphq_funnel_snapshots(funil_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_funnel_snapshots TO authenticated;
GRANT ALL ON public.imphq_funnel_snapshots TO service_role;

ALTER TABLE public.imphq_funnel_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read snapshots" ON public.imphq_funnel_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write snapshots" ON public.imphq_funnel_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete snapshots" ON public.imphq_funnel_snapshots
  FOR DELETE TO authenticated USING (true);

-- 3. Seed dos 6 templates oficiais
INSERT INTO public.imphq_funnel_templates (slug, nome, nicho, objetivo, descricao, canvas) VALUES
('lancamento-classico', 'Lançamento Clássico', 'Infoprodutos', 'lancamento',
 'Captura → 3 CPLs por e-mail → Carrinho aberto 7 dias. Modelo Formula de Lançamento.',
 '{"etapas":[
   {"nome":"Anúncio Captura","tipo":"criativo","visitantes":0,"conversoes":0,"pos_x":80,"pos_y":80,"connects_to":[1]},
   {"nome":"Página de Captura","tipo":"pagina","visitantes":0,"conversoes":0,"pos_x":380,"pos_y":80,"connects_to":[2]},
   {"nome":"E-mail Aquecimento","tipo":"email","visitantes":0,"conversoes":0,"pos_x":680,"pos_y":80,"connects_to":[3]},
   {"nome":"CPL 1","tipo":"vsl","visitantes":0,"conversoes":0,"pos_x":980,"pos_y":80,"connects_to":[4]},
   {"nome":"CPL 2","tipo":"vsl","visitantes":0,"conversoes":0,"pos_x":1280,"pos_y":80,"connects_to":[5]},
   {"nome":"CPL 3","tipo":"vsl","visitantes":0,"conversoes":0,"pos_x":1580,"pos_y":80,"connects_to":[6]},
   {"nome":"Carrinho Aberto","tipo":"checkout","visitantes":0,"conversoes":0,"pos_x":1880,"pos_y":80}
 ]}'::jsonb),
('perpetuo-vsl', 'Perpétuo VSL', 'Infoprodutos', 'perpetuo',
 'Tráfego frio → VSL → Checkout → OrderBump → Upsell → Downsell. Para escala diária.',
 '{"etapas":[
   {"nome":"Facebook Ads","tipo":"face_ads","visitantes":0,"conversoes":0,"pos_x":80,"pos_y":80,"connects_to":[1]},
   {"nome":"VSL","tipo":"vsl","visitantes":0,"conversoes":0,"pos_x":380,"pos_y":80,"connects_to":[2]},
   {"nome":"Checkout","tipo":"checkout","visitantes":0,"conversoes":0,"pos_x":680,"pos_y":80,"connects_to":[3]},
   {"nome":"OrderBump","tipo":"upsell","visitantes":0,"conversoes":0,"pos_x":980,"pos_y":80,"connects_to":[4]},
   {"nome":"Upsell Premium","tipo":"upsell","visitantes":0,"conversoes":0,"pos_x":1280,"pos_y":80,"connects_to":[5]},
   {"nome":"Downsell","tipo":"upsell","visitantes":0,"conversoes":0,"pos_x":1580,"pos_y":80}
 ]}'::jsonb),
('webinar-evergreen', 'Webinar Evergreen', 'Infoprodutos', 'webinar',
 'Anúncio → Registro → Webinar gravado → Pitch → Recuperação WhatsApp 72h.',
 '{"etapas":[
   {"nome":"Anúncio Registro","tipo":"criativo","visitantes":0,"conversoes":0,"pos_x":80,"pos_y":80,"connects_to":[1]},
   {"nome":"Página de Registro","tipo":"pagina","visitantes":0,"conversoes":0,"pos_x":380,"pos_y":80,"connects_to":[2]},
   {"nome":"Sala do Webinar","tipo":"vsl","visitantes":0,"conversoes":0,"pos_x":680,"pos_y":80,"connects_to":[3]},
   {"nome":"Pitch / Checkout","tipo":"checkout","visitantes":0,"conversoes":0,"pos_x":980,"pos_y":80,"connects_to":[4]},
   {"nome":"Recuperação WA 72h","tipo":"whatsapp","visitantes":0,"conversoes":0,"pos_x":1280,"pos_y":80}
 ]}'::jsonb),
('x1-dm-closer', 'X1 / DM Closer', 'Alto Ticket', 'x1',
 'Anúncio → DM Instagram → Qualificação WhatsApp → Call → Fechamento humano.',
 '{"etapas":[
   {"nome":"Anúncio DM","tipo":"criativo","visitantes":0,"conversoes":0,"pos_x":80,"pos_y":80,"connects_to":[1]},
   {"nome":"DM Instagram","tipo":"instagram","visitantes":0,"conversoes":0,"pos_x":380,"pos_y":80,"connects_to":[2]},
   {"nome":"Qualificação WA","tipo":"whatsapp","visitantes":0,"conversoes":0,"pos_x":680,"pos_y":80,"connects_to":[3]},
   {"nome":"Call Estratégica","tipo":"video","visitantes":0,"conversoes":0,"pos_x":980,"pos_y":80,"connects_to":[4]},
   {"nome":"Checkout / Boleto","tipo":"checkout","visitantes":0,"conversoes":0,"pos_x":1280,"pos_y":80}
 ]}'::jsonb),
('low-ticket-tripwire', 'Low-ticket Tripwire', 'E-commerce', 'low-ticket',
 'Anúncio → Checkout direto (R$ 9-29) → OrderBump → Upsell Premium. Ticket de entrada.',
 '{"etapas":[
   {"nome":"Tráfego Direto","tipo":"face_ads","visitantes":0,"conversoes":0,"pos_x":80,"pos_y":80,"connects_to":[1]},
   {"nome":"Checkout Tripwire","tipo":"checkout","visitantes":0,"conversoes":0,"pos_x":380,"pos_y":80,"connects_to":[2]},
   {"nome":"OrderBump","tipo":"upsell","visitantes":0,"conversoes":0,"pos_x":680,"pos_y":80,"connects_to":[3]},
   {"nome":"Upsell Premium","tipo":"upsell","visitantes":0,"conversoes":0,"pos_x":980,"pos_y":80}
 ]}'::jsonb),
('quiz-diagnostico', 'Quiz Diagnóstico', 'Qualquer', 'quiz',
 'Anúncio → Quiz interativo → Resultado segmentado → Oferta personalizada.',
 '{"etapas":[
   {"nome":"Anúncio Quiz","tipo":"criativo","visitantes":0,"conversoes":0,"pos_x":80,"pos_y":80,"connects_to":[1]},
   {"nome":"Quiz Interativo","tipo":"pagina","visitantes":0,"conversoes":0,"pos_x":380,"pos_y":80,"connects_to":[2]},
   {"nome":"Resultado Personalizado","tipo":"pagina","visitantes":0,"conversoes":0,"pos_x":680,"pos_y":80,"connects_to":[3]},
   {"nome":"Oferta Segmentada","tipo":"checkout","visitantes":0,"conversoes":0,"pos_x":980,"pos_y":80}
 ]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
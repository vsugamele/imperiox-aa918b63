
-- Jornada do Lead: metadados por produto + steps generativos
CREATE TABLE IF NOT EXISTS public.imphq_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id TEXT NOT NULL,
  produto_idx INT NOT NULL DEFAULT 0,
  produto_nome TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, produto_idx)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_journeys TO authenticated;
GRANT ALL ON public.imphq_journeys TO service_role;
ALTER TABLE public.imphq_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full imphq_journeys" ON public.imphq_journeys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.imphq_journey_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES public.imphq_journeys(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL, -- descoberta | interesse | consideracao | decisao | compra | pos
  bloco_tipo TEXT NOT NULL, -- vsl | email | ad_copy | landing | wa_seq | reels | qualif
  titulo TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | gerando | gerado | publicado | erro
  order_idx INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_journey_steps TO authenticated;
GRANT ALL ON public.imphq_journey_steps TO service_role;
ALTER TABLE public.imphq_journey_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full imphq_journey_steps" ON public.imphq_journey_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_journey_steps_journey ON public.imphq_journey_steps(journey_id, etapa, order_idx);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_journey_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_journeys_touch ON public.imphq_journeys;
CREATE TRIGGER trg_journeys_touch BEFORE UPDATE ON public.imphq_journeys
  FOR EACH ROW EXECUTE FUNCTION public.tg_journey_touch();

DROP TRIGGER IF EXISTS trg_journey_steps_touch ON public.imphq_journey_steps;
CREATE TRIGGER trg_journey_steps_touch BEFORE UPDATE ON public.imphq_journey_steps
  FOR EACH ROW EXECUTE FUNCTION public.tg_journey_touch();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_journey_steps;

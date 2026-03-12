CREATE TABLE imphq_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES imphq_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL DEFAULT '',
  url TEXT DEFAULT '',
  ponto_forte TEXT DEFAULT '',
  fraqueza TEXT DEFAULT '',
  canais_principais TEXT DEFAULT '',
  nicho TEXT DEFAULT '',
  sub_nicho TEXT DEFAULT '',
  publico_alvo TEXT DEFAULT '',
  mecanismo_unico TEXT DEFAULT '',
  score_escala INT DEFAULT 0,
  score_max INT DEFAULT 15,
  canais_keywords JSONB DEFAULT '[]',
  headline TEXT DEFAULT '',
  hook TEXT DEFAULT '',
  cta TEXT DEFAULT '',
  oferta_principal TEXT DEFAULT '',
  preco TEXT DEFAULT '',
  garantia TEXT DEFAULT '',
  bonus TEXT DEFAULT '',
  trafego_est TEXT DEFAULT '',
  ads_ativos BOOLEAN DEFAULT false,
  importado_em DATE,
  stack_tecnologico JSONB DEFAULT '[]',
  paginas_funil JSONB DEFAULT '[]',
  insights TEXT DEFAULT '',
  screenshot_url TEXT DEFAULT '',
  color TEXT DEFAULT '#c9922a',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE imphq_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own competitors"
  ON imphq_competitors FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_imphq_competitors_updated_at
  BEFORE UPDATE ON imphq_competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('competitor-screenshots', 'competitor-screenshots', true);

CREATE POLICY "Auth users upload competitor screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'competitor-screenshots');

CREATE POLICY "Public read competitor screenshots"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'competitor-screenshots');

CREATE POLICY "Auth users delete competitor screenshots"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'competitor-screenshots');
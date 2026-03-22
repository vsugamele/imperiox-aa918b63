CREATE TABLE imphq_ads_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL DEFAULT 'Facebook',
  campanha TEXT,
  data_ref DATE NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  impressoes INT DEFAULT 0,
  cliques INT DEFAULT 0,
  leads INT DEFAULT 0,
  moeda TEXT DEFAULT 'BRL',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_ads_spend ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_spend_all" ON imphq_ads_spend FOR ALL TO authenticated USING (true) WITH CHECK (true);
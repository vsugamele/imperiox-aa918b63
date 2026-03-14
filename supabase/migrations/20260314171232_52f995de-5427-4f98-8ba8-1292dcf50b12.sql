
-- Custos por projeto
CREATE TABLE imphq_project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT DEFAULT 'Outro',
  valor NUMERIC(10,2) DEFAULT 0,
  moeda TEXT DEFAULT 'BRL',
  recorrente BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_project_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project costs" ON imphq_project_costs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Receitas por projeto
CREATE TABLE imphq_project_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) DEFAULT 0,
  fonte TEXT DEFAULT 'Manual',
  data_ref DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_project_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project revenue" ON imphq_project_revenue FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- Tabela de Referências (Swipe File)
CREATE TABLE IF NOT EXISTS imphq_referencias (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE SET NULL,
  tipo TEXT DEFAULT 'criativo',
  titulo TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  tags TEXT[],
  notas TEXT,
  score INTEGER DEFAULT 0,
  plataforma TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campos analytics no imphq_projects
ALTER TABLE imphq_projects
  ADD COLUMN IF NOT EXISTS clarity_id TEXT,
  ADD COLUMN IF NOT EXISTS ga_id TEXT;

-- Tabela de Webhooks
CREATE TABLE IF NOT EXISTS imphq_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE SET NULL,
  plataforma TEXT NOT NULL,
  evento TEXT NOT NULL,
  payload JSONB,
  lead_id TEXT REFERENCES imphq_leads(id) ON DELETE SET NULL,
  processado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Automações
CREATE TABLE IF NOT EXISTS imphq_automacoes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  trigger_tipo TEXT NOT NULL,
  acoes JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger de updated_at para referencias
CREATE TRIGGER set_updated_at_imphq_referencias
  BEFORE UPDATE ON imphq_referencias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger de updated_at para automacoes
CREATE TRIGGER set_updated_at_imphq_automacoes
  BEFORE UPDATE ON imphq_automacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

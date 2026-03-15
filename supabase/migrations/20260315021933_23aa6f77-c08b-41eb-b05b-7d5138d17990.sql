
-- Criar tabela providers que falhou na migration anterior
CREATE TABLE IF NOT EXISTS imphq_wa_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('evolution', 'twilio')),
  instance_name TEXT,
  api_url TEXT,
  api_key TEXT,
  twilio_from TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_wa_providers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'imphq_wa_providers' AND policyname = 'Users can manage wa providers') THEN
    CREATE POLICY "Users can manage wa providers" ON imphq_wa_providers FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Adicionar colunas faltantes em imphq_wa_messages
ALTER TABLE imphq_wa_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE imphq_wa_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE imphq_wa_messages ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Adicionar provider_id na tabela de conversas
ALTER TABLE imphq_wa_conversations ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES imphq_wa_providers(id);

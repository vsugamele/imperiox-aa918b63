-- Sprint 1: Memória de Lead + ia_ativa por conversa + awareness_level

-- 1. lead_memory JSONB em imphq_leads
ALTER TABLE imphq_leads
  ADD COLUMN IF NOT EXISTS lead_memory jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS awareness_level smallint DEFAULT 0 CHECK (awareness_level BETWEEN 0 AND 5);

COMMENT ON COLUMN imphq_leads.lead_memory IS 'Memória persistente: nome_preferido, objecoes, gatilhos, nivel_consciencia, notas_ia, etc.';
COMMENT ON COLUMN imphq_leads.awareness_level IS 'Nível de consciência Schwartz (0=desconhecido, 1=inconsciente, 5=pronto para comprar)';

-- 2. ia_ativa + conversation_summary em imphq_wa_conversations
ALTER TABLE imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS ia_ativa boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS conversation_summary text,
  ADD COLUMN IF NOT EXISTS lead_id text REFERENCES imphq_leads(id) ON DELETE SET NULL;

COMMENT ON COLUMN imphq_wa_conversations.ia_ativa IS 'Toggle de IA por conversa (false = atendimento manual)';
COMMENT ON COLUMN imphq_wa_conversations.conversation_summary IS 'Resumo da última sessão extraído pela IA';
COMMENT ON COLUMN imphq_wa_conversations.lead_id IS 'Link para o lead associado a esta conversa';

-- Índice para lookup por lead_id
CREATE INDEX IF NOT EXISTS idx_wa_conversations_lead_id ON imphq_wa_conversations(lead_id);

-- 3. awareness_level em imphq_wa_triage (para rastrear evolução)
ALTER TABLE imphq_wa_triage
  ADD COLUMN IF NOT EXISTS awareness_level smallint DEFAULT 0;

-- 4. ia_ativa em imphq_ig_conversations (mesma lógica para Instagram)
ALTER TABLE imphq_ig_conversations
  ADD COLUMN IF NOT EXISTS ia_ativa boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS conversation_summary text;

-- 5. Função para vincular conversa WA ao lead pelo telefone (fire-and-forget no webhook)
CREATE OR REPLACE FUNCTION link_wa_conversation_to_lead(p_conv_id text, p_phone text, p_project_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id text;
  clean_phone text;
BEGIN
  clean_phone := regexp_replace(p_phone, '\D', '', 'g');
  -- Busca lead pelo phone no mesmo projeto ou sem projeto
  SELECT id INTO v_lead_id
  FROM imphq_leads
  WHERE regexp_replace(COALESCE(phone,''), '\D', '', 'g') = clean_phone
    AND (project_id = p_project_id OR project_id IS NULL)
  ORDER BY (project_id = p_project_id) DESC, updated_at DESC
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE imphq_wa_conversations
    SET lead_id = v_lead_id
    WHERE id = p_conv_id AND (lead_id IS NULL OR lead_id != v_lead_id);
  END IF;
END;
$$;

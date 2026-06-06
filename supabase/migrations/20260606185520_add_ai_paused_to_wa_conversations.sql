-- Adiciona coluna ai_paused_until em imphq_wa_conversations
-- Quando humano responde, a IA é pausada por X minutos
-- Para retomar manualmente: UPDATE imphq_wa_conversations SET ai_paused_until = NULL WHERE id = '...'
ALTER TABLE imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ DEFAULT NULL;

-- Index para queries de verificação de pausa
CREATE INDEX IF NOT EXISTS idx_wa_conv_ai_paused_until
  ON imphq_wa_conversations (ai_paused_until)
  WHERE ai_paused_until IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN imphq_wa_conversations.ai_paused_until IS
  'Quando setado, a IA não responde até este timestamp. Setado automaticamente quando humano envia mensagem (pausa de 30min). Setar NULL para retomar a IA manualmente.';

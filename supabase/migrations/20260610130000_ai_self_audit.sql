-- Self-audit noturno: IA analisa próprias conversas ruins e atualiza banned_phrases/custom_instructions
ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS auto_audit_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_audit_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_findings jsonb DEFAULT '[]'::jsonb;

-- Idempotência: não auditar mesma conversa 2x
ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS audited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_conv_audited
  ON public.imphq_wa_conversations (audited_at, last_message_at)
  WHERE audited_at IS NULL;

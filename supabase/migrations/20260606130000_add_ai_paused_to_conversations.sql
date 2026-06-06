-- Add ai_paused per-conversation human takeover support
ALTER TABLE imphq_ig_conversations
ADD COLUMN IF NOT EXISTS ai_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_paused_reason text DEFAULT NULL;

COMMENT ON COLUMN imphq_ig_conversations.ai_paused IS 'When true, the AI will not auto-reply to this conversation — a human operator has taken over.';
COMMENT ON COLUMN imphq_ig_conversations.ai_paused_reason IS 'Reason why the conversation was paused from AI (e.g. Operador assumiu).';

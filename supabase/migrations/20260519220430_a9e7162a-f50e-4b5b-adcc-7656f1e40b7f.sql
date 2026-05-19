ALTER TABLE imphq_wa_conversations 
  ADD COLUMN IF NOT EXISTS ai_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS ai_last_reply_at timestamptz;
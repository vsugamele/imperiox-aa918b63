ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS last_memory_extract_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_memory_extract_msg_count int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_wa_conv_memory_extract
  ON public.imphq_wa_conversations (last_memory_extract_at);
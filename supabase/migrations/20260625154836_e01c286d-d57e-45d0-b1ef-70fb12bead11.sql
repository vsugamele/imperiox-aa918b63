ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS last_memory_extract_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_memory_extract_msg_count INTEGER NOT NULL DEFAULT 0;
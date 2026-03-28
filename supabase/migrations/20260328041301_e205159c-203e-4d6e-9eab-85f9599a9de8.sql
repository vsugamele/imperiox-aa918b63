-- Enable replica identity for chat realtime
ALTER TABLE imphq_chat_messages REPLICA IDENTITY FULL;

-- Ensure RLS policy for SELECT on chat messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imphq_chat_messages' AND policyname = 'chat_select_authenticated'
  ) THEN
    CREATE POLICY "chat_select_authenticated" ON imphq_chat_messages FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Ensure RLS policy for DELETE on chat messages (own messages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imphq_chat_messages' AND policyname = 'chat_delete_own'
  ) THEN
    CREATE POLICY "chat_delete_own" ON imphq_chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Ensure RLS policy for INSERT on chat messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imphq_chat_messages' AND policyname = 'chat_insert_authenticated'
  ) THEN
    CREATE POLICY "chat_insert_authenticated" ON imphq_chat_messages FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
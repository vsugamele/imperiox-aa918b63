
-- Add missing columns to imphq_wa_messages
ALTER TABLE public.imphq_wa_messages
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outgoing',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS project_id text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent';

-- Make role nullable with default so edge function inserts work
ALTER TABLE public.imphq_wa_messages
  ALTER COLUMN role SET DEFAULT 'user',
  ALTER COLUMN role DROP NOT NULL;

-- Enable RLS on imphq_wa_messages
ALTER TABLE public.imphq_wa_messages ENABLE ROW LEVEL SECURITY;

-- Policies for imphq_wa_messages (authenticated users)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can read wa messages' AND tablename = 'imphq_wa_messages') THEN
    CREATE POLICY "Authenticated can read wa messages"
      ON public.imphq_wa_messages FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can insert wa messages' AND tablename = 'imphq_wa_messages') THEN
    CREATE POLICY "Authenticated can insert wa messages"
      ON public.imphq_wa_messages FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Ensure RLS on imphq_wa_conversations
ALTER TABLE public.imphq_wa_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can read wa conversations' AND tablename = 'imphq_wa_conversations') THEN
    CREATE POLICY "Authenticated can read wa conversations"
      ON public.imphq_wa_conversations FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can insert wa conversations' AND tablename = 'imphq_wa_conversations') THEN
    CREATE POLICY "Authenticated can insert wa conversations"
      ON public.imphq_wa_conversations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can update wa conversations' AND tablename = 'imphq_wa_conversations') THEN
    CREATE POLICY "Authenticated can update wa conversations"
      ON public.imphq_wa_conversations FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can delete wa conversations' AND tablename = 'imphq_wa_conversations') THEN
    CREATE POLICY "Authenticated can delete wa conversations"
      ON public.imphq_wa_conversations FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Allow service_role (edge functions) to insert/update without RLS issues
-- Edge functions use service_role key which bypasses RLS, so this is already handled.

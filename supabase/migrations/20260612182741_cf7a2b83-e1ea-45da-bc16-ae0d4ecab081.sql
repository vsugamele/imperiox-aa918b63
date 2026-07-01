
ALTER TABLE public.imphq_wa_conversations ADD COLUMN IF NOT EXISTS assigned_to UUID NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conv_assigned ON public.imphq_wa_conversations(assigned_to);

CREATE TABLE IF NOT EXISTS public.imphq_wa_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  author_id UUID NULL,
  author_name TEXT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_notes_conv ON public.imphq_wa_internal_notes(conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_wa_internal_notes TO authenticated;
GRANT ALL ON public.imphq_wa_internal_notes TO service_role;

ALTER TABLE public.imphq_wa_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read notes" ON public.imphq_wa_internal_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert notes" ON public.imphq_wa_internal_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth delete own notes" ON public.imphq_wa_internal_notes FOR DELETE TO authenticated USING (author_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_wa_internal_notes;

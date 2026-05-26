CREATE TABLE public.imphq_wa_contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  phone text NOT NULL,
  tag text NOT NULL,
  color text DEFAULT '#c9922a',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, phone, tag)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_wa_contact_tags TO authenticated;
GRANT ALL ON public.imphq_wa_contact_tags TO service_role;

ALTER TABLE public.imphq_wa_contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read wa contact tags"
ON public.imphq_wa_contact_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert wa contact tags"
ON public.imphq_wa_contact_tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "auth delete own wa contact tags"
ON public.imphq_wa_contact_tags FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_wa_contact_tags_project_phone ON public.imphq_wa_contact_tags (project_id, phone);
CREATE INDEX idx_wa_contact_tags_tag ON public.imphq_wa_contact_tags (project_id, tag);

CREATE OR REPLACE FUNCTION public.mark_wa_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.imphq_wa_conversations
  SET unread_count = 0, last_read_at = now()
  WHERE id = _conversation_id;
$$;

GRANT EXECUTE ON FUNCTION public.mark_wa_conversation_read(uuid) TO authenticated;
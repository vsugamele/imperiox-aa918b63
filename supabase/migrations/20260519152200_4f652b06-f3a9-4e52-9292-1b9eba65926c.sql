
ALTER TABLE public.imphq_wa_conversations
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_direction text;

CREATE OR REPLACE FUNCTION public.trg_wa_msg_bump_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.imphq_wa_conversations
  SET last_message = LEFT(COALESCE(NEW.content, ''), 200),
      last_message_at = COALESCE(NEW.created_at, now()),
      last_message_direction = NEW.direction,
      updated_at = now(),
      unread_count = CASE WHEN NEW.direction = 'in' THEN unread_count + 1 ELSE unread_count END,
      message_count = COALESCE(message_count, 0) + 1
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_msg_bump_conversation ON public.imphq_wa_messages;
CREATE TRIGGER trg_wa_msg_bump_conversation
AFTER INSERT ON public.imphq_wa_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_wa_msg_bump_conversation();

CREATE INDEX IF NOT EXISTS idx_wa_conv_last_message_at
  ON public.imphq_wa_conversations (last_message_at DESC NULLS LAST);

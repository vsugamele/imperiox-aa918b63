-- Realtime
ALTER TABLE public.imphq_wa_messages REPLICA IDENTITY FULL;
ALTER TABLE public.imphq_wa_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.imphq_wa_triage REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_wa_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_wa_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_wa_triage; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Contexto extra para auto-resposta
ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS expert_persona text,
  ADD COLUMN IF NOT EXISTS custom_instructions text,
  ADD COLUMN IF NOT EXISTS product_focus text,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb;
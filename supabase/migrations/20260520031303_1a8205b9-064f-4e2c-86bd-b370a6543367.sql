
-- Backfill: usa o provider ativo do projeto como melhor palpite
UPDATE public.imphq_wa_conversations c
SET provider_id = p.id
FROM public.imphq_wa_providers p
WHERE c.provider_id IS NULL
  AND p.project_id = c.project_id
  AND p.is_active = true;

-- Troca a unique key para incluir provider_id
ALTER TABLE public.imphq_wa_conversations
  DROP CONSTRAINT IF EXISTS imphq_wa_conversations_project_id_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS imphq_wa_conversations_project_phone_provider_key
  ON public.imphq_wa_conversations (project_id, phone, COALESCE(provider_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS imphq_wa_conversations_project_phone_idx
  ON public.imphq_wa_conversations (project_id, phone);

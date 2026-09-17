-- 1. Índices de dedup nos logs de webhook
CREATE INDEX IF NOT EXISTS idx_ig_wh_logs_msgid_data
  ON public.imphq_ig_webhook_logs ((payload->'data'->'message'->>'id'))
  WHERE payload->'data'->'message'->>'id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ig_wh_logs_msgid_root
  ON public.imphq_ig_webhook_logs ((payload->'message'->>'id'))
  WHERE payload->'message'->>'id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ig_wh_logs_event_processed_created
  ON public.imphq_ig_webhook_logs (event_type, processed, created_at DESC);

-- 2. Índices na base de conhecimento
CREATE INDEX IF NOT EXISTS idx_wa_knowledge_project_source
  ON public.imphq_wa_knowledge (project_id, source);

CREATE INDEX IF NOT EXISTS idx_wa_knowledge_source_pattern
  ON public.imphq_wa_knowledge (source text_pattern_ops);

-- 3. Última mensagem enviada por conversa
CREATE INDEX IF NOT EXISTS idx_wa_messages_conv_dir_created
  ON public.imphq_wa_messages (conversation_id, direction, created_at DESC);

-- 4. Arquivamento dos logs de webhook
CREATE TABLE IF NOT EXISTS public.imphq_ig_webhook_logs_archive (
  id uuid PRIMARY KEY,
  event_type text,
  payload jsonb,
  account_id uuid,
  processed boolean,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.imphq_ig_webhook_logs_archive TO service_role;

ALTER TABLE public.imphq_ig_webhook_logs_archive ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ig_wh_logs_archive_created
  ON public.imphq_ig_webhook_logs_archive (created_at DESC);

CREATE OR REPLACE FUNCTION public.imphq_archive_webhook_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved integer := 0;
  purged integer := 0;
BEGIN
  WITH old AS (
    DELETE FROM public.imphq_ig_webhook_logs
    WHERE processed = true
      AND created_at < now() - interval '14 days'
    RETURNING id, event_type, payload, account_id, processed, error, created_at
  ), ins AS (
    INSERT INTO public.imphq_ig_webhook_logs_archive
      (id, event_type, payload, account_id, processed, error, created_at)
    SELECT id, event_type, payload, account_id, processed, error, created_at FROM old
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO moved FROM ins;

  WITH del AS (
    DELETE FROM public.imphq_ig_webhook_logs_archive
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO purged FROM del;

  RETURN jsonb_build_object('moved', moved, 'purged', purged);
END;
$$;

-- 5. Reduzir índice ivfflat sobredimensionado
DROP INDEX IF EXISTS public.imphq_wa_knowledge_embedding_idx;
CREATE INDEX imphq_wa_knowledge_embedding_idx
  ON public.imphq_wa_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);


-- Normaliza telefone BR para 13 dígitos (insere "9" após DDD em celulares de 12 dígitos)
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  clean TEXT;
BEGIN
  IF p_phone IS NULL THEN RETURN NULL; END IF;
  clean := regexp_replace(p_phone, '\D', '', 'g');
  -- 12 dígitos começando com 55 + DDD (2) + 8 dígitos → injeta 9
  IF length(clean) = 12 AND left(clean, 2) = '55' THEN
    RETURN left(clean, 4) || '9' || substring(clean FROM 5);
  END IF;
  RETURN clean;
END;
$$;

-- Detecta pares duplicados (mesmo projeto, telefones que normalizam para o mesmo canônico)
CREATE OR REPLACE FUNCTION public.find_wa_phone_duplicates(p_project_id TEXT)
RETURNS TABLE(
  canonical_phone TEXT,
  keep_id UUID,
  keep_phone TEXT,
  keep_msg_count INT,
  drop_id UUID,
  drop_phone TEXT,
  drop_msg_count INT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH grouped AS (
    SELECT
      id,
      phone,
      COALESCE(message_count, 0) AS message_count,
      last_message_at,
      public.normalize_br_phone(phone) AS canon
    FROM public.imphq_wa_conversations
    WHERE project_id = p_project_id
  ),
  pairs AS (
    SELECT
      canon,
      array_agg(id ORDER BY message_count DESC NULLS LAST, last_message_at DESC NULLS LAST) AS ids,
      array_agg(phone ORDER BY message_count DESC NULLS LAST, last_message_at DESC NULLS LAST) AS phones,
      array_agg(message_count ORDER BY message_count DESC NULLS LAST, last_message_at DESC NULLS LAST) AS counts
    FROM grouped
    GROUP BY canon
    HAVING count(*) > 1
  )
  SELECT
    canon,
    ids[1], phones[1], counts[1],
    ids[2], phones[2], counts[2]
  FROM pairs;
$$;

-- Mescla duas conversas: move tudo de drop_id para keep_id, soma counts, apaga drop
CREATE OR REPLACE FUNCTION public.merge_wa_conversations(p_keep_id UUID, p_drop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep_row RECORD;
  drop_row RECORD;
  moved_messages INT := 0;
  moved_notes INT := 0;
BEGIN
  IF p_keep_id = p_drop_id THEN
    RAISE EXCEPTION 'keep_id e drop_id devem ser diferentes';
  END IF;

  SELECT * INTO keep_row FROM public.imphq_wa_conversations WHERE id = p_keep_id;
  SELECT * INTO drop_row FROM public.imphq_wa_conversations WHERE id = p_drop_id;
  IF keep_row IS NULL OR drop_row IS NULL THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;
  IF keep_row.project_id <> drop_row.project_id THEN
    RAISE EXCEPTION 'Conversas pertencem a projetos diferentes';
  END IF;

  -- Move mensagens
  UPDATE public.imphq_wa_messages SET conversation_id = p_keep_id WHERE conversation_id = p_drop_id;
  GET DIAGNOSTICS moved_messages = ROW_COUNT;

  -- Move notas internas
  UPDATE public.imphq_wa_internal_notes SET conversation_id = p_keep_id WHERE conversation_id = p_drop_id;
  GET DIAGNOSTICS moved_notes = ROW_COUNT;

  -- Mescla tabelas opcionais (não falha se não existirem registros)
  BEGIN
    UPDATE public.imphq_wa_lead_memory
      SET phone = keep_row.phone
      WHERE phone = drop_row.phone;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.imphq_wa_contact_tags
      SET conversation_id = p_keep_id
      WHERE conversation_id = p_drop_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.imphq_wa_ai_logs
      SET conversation_id = p_keep_id
      WHERE conversation_id = p_drop_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Atualiza agregados na conversa principal
  UPDATE public.imphq_wa_conversations
  SET
    message_count = COALESCE(keep_row.message_count, 0) + COALESCE(drop_row.message_count, 0),
    unread_count = COALESCE(keep_row.unread_count, 0) + COALESCE(drop_row.unread_count, 0),
    last_message_at = GREATEST(
      COALESCE(keep_row.last_message_at, '1970-01-01'::timestamptz),
      COALESCE(drop_row.last_message_at, '1970-01-01'::timestamptz)
    ),
    last_message = COALESCE(
      (SELECT content FROM public.imphq_wa_messages WHERE conversation_id = p_keep_id ORDER BY created_at DESC LIMIT 1),
      keep_row.last_message
    ),
    contact_name = COALESCE(keep_row.contact_name, drop_row.contact_name),
    avatar_url = COALESCE(keep_row.avatar_url, drop_row.avatar_url),
    updated_at = now()
  WHERE id = p_keep_id;

  -- Apaga a duplicada
  DELETE FROM public.imphq_wa_conversations WHERE id = p_drop_id;

  RETURN jsonb_build_object(
    'keep_id', p_keep_id,
    'drop_id', p_drop_id,
    'moved_messages', moved_messages,
    'moved_notes', moved_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_br_phone(TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.find_wa_phone_duplicates(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_wa_conversations(UUID, UUID) TO authenticated, service_role;

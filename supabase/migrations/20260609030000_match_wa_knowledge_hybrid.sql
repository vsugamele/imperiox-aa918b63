-- Migration: RAG functions and lead memory table
-- 1. match_wa_knowledge_hybrid — was missing, causing silent RAG failures in wa-ai-reply
-- 2. imphq_wa_lead_memories + match_wa_lead_memory — vector store for lead context

-- ── 1. match_wa_knowledge_hybrid ────────────────────────────────────────────
-- Blends semantic similarity + text relevance. Only returns aprovada=true rows.
DROP FUNCTION IF EXISTS public.match_wa_knowledge_hybrid CASCADE;
CREATE OR REPLACE FUNCTION public.match_wa_knowledge_hybrid(
  query_embedding extensions.vector(768),
  p_project_id text,
  query_text text DEFAULT '',
  match_count int DEFAULT 3,
  min_similarity float DEFAULT 0.65
)
RETURNS TABLE (
  id uuid,
  pergunta text,
  resposta text,
  similarity float,
  score_uso int,
  source text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    k.id,
    k.pergunta,
    k.resposta,
    CASE
      WHEN length(query_text) > 3 AND k.pergunta ILIKE '%' || query_text || '%'
        THEN LEAST(1.0, (1 - (k.embedding <=> query_embedding)) * 0.7 + 0.3)
      ELSE (1 - (k.embedding <=> query_embedding))
    END AS similarity,
    k.score_uso,
    k.source
  FROM public.imphq_wa_knowledge k
  WHERE k.project_id = p_project_id
    AND k.embedding IS NOT NULL
    AND k.aprovada = true
    AND (1 - (k.embedding <=> query_embedding)) >= min_similarity
  ORDER BY similarity DESC, k.score_uso DESC
  LIMIT match_count;
$$;

-- ── 2. Lead memory vector store ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.imphq_wa_lead_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.imphq_projects(id) ON DELETE CASCADE,
  lead_id text REFERENCES public.imphq_leads(id) ON DELETE CASCADE,
  phone text,
  content text NOT NULL,
  memory_type text NOT NULL DEFAULT 'general',
  embedding extensions.vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, content, memory_type)
);

ALTER TABLE public.imphq_wa_lead_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_lead_memories" ON public.imphq_wa_lead_memories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lead_memories_project ON public.imphq_wa_lead_memories(project_id);
CREATE INDEX IF NOT EXISTS idx_lead_memories_lead ON public.imphq_wa_lead_memories(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_memories_phone ON public.imphq_wa_lead_memories(phone);
CREATE INDEX IF NOT EXISTS idx_lead_memories_embedding
  ON public.imphq_wa_lead_memories USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 50);

-- ── 3. match_wa_lead_memory ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_wa_lead_memory(
  query_embedding extensions.vector(768),
  p_project_id text,
  p_phone text DEFAULT '',
  match_count int DEFAULT 3,
  min_similarity float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    m.id,
    m.content,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.imphq_wa_lead_memories m
  WHERE m.project_id = p_project_id
    AND (p_phone = '' OR m.phone = p_phone)
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) >= min_similarity
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.imphq_agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.imphq_ai_agents(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'file',
  source_name text NOT NULL,
  source_path text,
  chunk_index int NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding extensions.vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_agent_knowledge TO authenticated;
GRANT ALL ON public.imphq_agent_knowledge TO service_role;

ALTER TABLE public.imphq_agent_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_knowledge_authenticated_all"
  ON public.imphq_agent_knowledge
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS imphq_agent_knowledge_agent_idx
  ON public.imphq_agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS imphq_agent_knowledge_source_idx
  ON public.imphq_agent_knowledge(agent_id, source_path);
CREATE INDEX IF NOT EXISTS imphq_agent_knowledge_embedding_idx
  ON public.imphq_agent_knowledge USING hnsw (embedding extensions.vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_agent_knowledge(
  p_agent_id uuid,
  query_embedding extensions.vector(768),
  match_count int DEFAULT 4,
  min_similarity float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  content text,
  source_name text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT k.id, k.content, k.source_name,
         1 - (k.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.imphq_agent_knowledge k
  WHERE k.agent_id = p_agent_id
    AND k.embedding IS NOT NULL
    AND 1 - (k.embedding OPERATOR(extensions.<=>) query_embedding) >= min_similarity
  ORDER BY k.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT match_count;
$$;
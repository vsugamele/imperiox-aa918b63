-- 1. RAG chunks table
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.imphq_rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text,
  source_type text NOT NULL,
  source_id text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, chunk_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_rag_chunks TO authenticated;
GRANT ALL ON public.imphq_rag_chunks TO service_role;

ALTER TABLE public.imphq_rag_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rag_chunks_authenticated_all"
  ON public.imphq_rag_chunks FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_project ON public.imphq_rag_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON public.imphq_rag_chunks(source_type, source_id);

-- 2. Add missing "nome" columns to satisfy legacy references
ALTER TABLE public.imphq_vendas ADD COLUMN IF NOT EXISTS nome text;

-- Generated alias column mirroring contact_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='imphq_wa_conversations' AND column_name='nome'
  ) THEN
    EXECUTE 'ALTER TABLE public.imphq_wa_conversations ADD COLUMN nome text GENERATED ALWAYS AS (contact_name) STORED';
  END IF;
END $$;

-- 3. webi_retention_buckets INSERT policy (public tracking pixel style)
DROP POLICY IF EXISTS "webi_retention_buckets_insert" ON public.webi_retention_buckets;
CREATE POLICY "webi_retention_buckets_insert"
  ON public.webi_retention_buckets FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "webi_retention_buckets_update" ON public.webi_retention_buckets;
CREATE POLICY "webi_retention_buckets_update"
  ON public.webi_retention_buckets FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE ON public.webi_retention_buckets TO anon, authenticated;
-- Embedding cache: evita pagar para gerar o mesmo embedding 2+ vezes
-- Key: SHA256(normalized_text + "::" + model + "::" + dims)
CREATE TABLE IF NOT EXISTS public.imphq_embedding_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash text NOT NULL,
  model text NOT NULL,
  dimensions integer NOT NULL,
  embedding vector(768),
  text_preview text,
  hits integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  UNIQUE (text_hash, model, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash
  ON public.imphq_embedding_cache (text_hash);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_lastused
  ON public.imphq_embedding_cache (last_used_at);

ALTER TABLE public.imphq_embedding_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embedding_cache_service_role" ON public.imphq_embedding_cache;
CREATE POLICY "embedding_cache_service_role"
  ON public.imphq_embedding_cache FOR ALL
  TO service_role USING (true) WITH CHECK (true);

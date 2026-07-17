
ALTER TABLE public.imphq_swipes 
  ADD COLUMN IF NOT EXISTS favorito boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_privadas text,
  ADD COLUMN IF NOT EXISTS resultado jsonb,
  ADD COLUMN IF NOT EXISTS lido_em timestamptz,
  ADD COLUMN IF NOT EXISTS colecao_id uuid;

CREATE TABLE IF NOT EXISTS public.imphq_swipe_colecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  cor text DEFAULT '#c9922a',
  ordem smallint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_swipe_colecoes TO authenticated;
GRANT ALL ON public.imphq_swipe_colecoes TO service_role;
ALTER TABLE public.imphq_swipe_colecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_colecoes" ON public.imphq_swipe_colecoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_swipes_favorito ON public.imphq_swipes(user_id, favorito) WHERE favorito = true;
CREATE INDEX IF NOT EXISTS idx_swipes_colecao ON public.imphq_swipes(colecao_id);

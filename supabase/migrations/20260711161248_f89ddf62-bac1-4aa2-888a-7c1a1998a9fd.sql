ALTER TABLE public.imphq_empresa
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS mapa_node_id TEXT;
ALTER TABLE public.imphq_projects ADD COLUMN IF NOT EXISTS meta_offline_event_set_id TEXT;
ALTER TABLE public.imphq_vendas ADD COLUMN IF NOT EXISTS meta_offline_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_vendas_offline_pending ON public.imphq_vendas (project_id, data_venda) WHERE meta_offline_synced_at IS NULL;
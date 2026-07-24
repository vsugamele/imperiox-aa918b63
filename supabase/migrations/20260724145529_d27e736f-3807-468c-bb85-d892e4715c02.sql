ALTER TABLE public.imphq_kanban_cards ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.imphq_kanban_cards ADD COLUMN IF NOT EXISTS status_color text;
CREATE INDEX IF NOT EXISTS idx_imphq_kanban_cards_metrics ON public.imphq_kanban_cards USING gin (metrics);
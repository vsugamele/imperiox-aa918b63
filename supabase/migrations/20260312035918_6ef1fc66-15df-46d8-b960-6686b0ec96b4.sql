ALTER TABLE imphq_kanban_columns ADD COLUMN IF NOT EXISTS board TEXT DEFAULT 'agentes';
ALTER TABLE imphq_kanban_cards ADD COLUMN IF NOT EXISTS board TEXT DEFAULT 'agentes';
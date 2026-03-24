
CREATE TABLE IF NOT EXISTS imphq_card_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES imphq_kanban_cards(id) ON DELETE CASCADE NOT NULL,
  related_card_id UUID REFERENCES imphq_kanban_cards(id) ON DELETE CASCADE NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'related',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(card_id, related_card_id)
);

ALTER TABLE imphq_card_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON imphq_card_relations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS imphq_card_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES imphq_kanban_cards(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE imphq_card_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage card attachments"
  ON imphq_card_attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
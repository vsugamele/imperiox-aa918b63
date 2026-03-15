
CREATE TABLE imphq_team_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES imphq_team_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Novo Documento',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE imphq_team_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON imphq_team_docs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

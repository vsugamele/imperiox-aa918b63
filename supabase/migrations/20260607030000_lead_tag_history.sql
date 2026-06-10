-- Lead tag history: tracks when each tag was added/removed and by what source
CREATE TABLE IF NOT EXISTS imphq_lead_tag_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     text NOT NULL,
  project_id  text,
  tag         text NOT NULL,
  action      text NOT NULL CHECK (action IN ('added', 'removed')),
  source      text,           -- 'triage', 'manual', 'openflow', 'webhook'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_tag_history_lead ON imphq_lead_tag_history (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_tag_history_project ON imphq_lead_tag_history (project_id, created_at DESC);

ALTER TABLE imphq_lead_tag_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users" ON imphq_lead_tag_history FOR ALL USING (auth.role() = 'authenticated');

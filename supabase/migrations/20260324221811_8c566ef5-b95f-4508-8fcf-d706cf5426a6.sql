-- Chat messages table
CREATE TABLE imphq_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE imphq_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all chat messages"
  ON imphq_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own chat messages"
  ON imphq_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_messages_created ON imphq_chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_project ON imphq_chat_messages(project_id);

-- Activity log table
CREATE TABLE imphq_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE imphq_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all activity logs"
  ON imphq_activity_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own activity logs"
  ON imphq_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_activity_log_created ON imphq_activity_log(created_at DESC);
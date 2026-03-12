
-- Calendar events table (project_id is TEXT to match imphq_projects.id)
CREATE TABLE imphq_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  event_type TEXT DEFAULT 'general',
  color TEXT,
  all_day BOOLEAN DEFAULT false,
  reminder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own events" ON imphq_calendar_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Content library table
CREATE TABLE imphq_content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'image',
  thumbnail_url TEXT,
  tags TEXT[],
  description TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own content" ON imphq_content_library FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Storage bucket for project content
INSERT INTO storage.buckets (id, name, public) VALUES ('project-content', 'project-content', true);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload project content" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-content');
CREATE POLICY "Anyone can view project content" ON storage.objects FOR SELECT USING (bucket_id = 'project-content');
CREATE POLICY "Users can delete own project content" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-content' AND (storage.foldername(name))[1] = auth.uid()::text);

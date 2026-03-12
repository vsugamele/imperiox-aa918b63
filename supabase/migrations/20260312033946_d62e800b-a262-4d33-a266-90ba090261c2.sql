INSERT INTO storage.buckets (id, name, public)
VALUES ('project-media', 'project-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users upload project media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-media');

CREATE POLICY "Public read project media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-media');

CREATE POLICY "Auth users delete project media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-media');
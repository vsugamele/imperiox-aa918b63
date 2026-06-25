
CREATE POLICY "site-thumbs read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-thumbs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "site-thumbs insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-thumbs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "site-thumbs update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-thumbs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "site-thumbs delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-thumbs' AND auth.uid()::text = (storage.foldername(name))[1]);


DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='swipe_media_own_select') THEN
    CREATE POLICY "swipe_media_own_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'swipe-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='swipe_media_own_insert') THEN
    CREATE POLICY "swipe_media_own_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'swipe-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='swipe_media_own_delete') THEN
    CREATE POLICY "swipe_media_own_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'swipe-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

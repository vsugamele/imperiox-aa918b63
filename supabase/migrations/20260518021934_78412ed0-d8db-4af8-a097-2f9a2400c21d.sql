INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-previews', 'studio-previews', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "studio_previews_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'studio-previews');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
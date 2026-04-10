
-- Create whatsapp-media bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "WhatsApp media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete whatsapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow service role (edge functions) full access via default policies

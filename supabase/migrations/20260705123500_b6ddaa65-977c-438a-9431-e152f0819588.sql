
ALTER TABLE public.imphq_company_map_nodes ADD COLUMN IF NOT EXISTS image_url text;

-- Allow authenticated users to manage company-map-images objects
CREATE POLICY "company_map_images_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'company-map-images');
CREATE POLICY "company_map_images_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-map-images');
CREATE POLICY "company_map_images_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-map-images');
CREATE POLICY "company_map_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-map-images');

-- Add documento_url column to imphq_project_costs
ALTER TABLE imphq_project_costs ADD COLUMN IF NOT EXISTS documento_url TEXT;

-- Create project-docs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-docs', 'project-docs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for project-docs bucket
CREATE POLICY "Authenticated users can upload project docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-docs');

CREATE POLICY "Authenticated users can read project docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-docs');

CREATE POLICY "Authenticated users can delete project docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-docs');
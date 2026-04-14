
CREATE TABLE public.imphq_generated_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  product_name TEXT,
  model_used TEXT,
  custom_prompt TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_generated_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own generated contents"
  ON public.imphq_generated_contents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_imphq_generated_contents_project ON public.imphq_generated_contents(project_id);

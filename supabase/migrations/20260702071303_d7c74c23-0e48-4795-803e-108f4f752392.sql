
ALTER TABLE public.imphq_flow_image_jobs 
  ADD COLUMN IF NOT EXISTS execution_id uuid,
  ADD COLUMN IF NOT EXISTS automacao_id text,
  ADD COLUMN IF NOT EXISTS send_after boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS context jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS size text DEFAULT '1024x1024',
  ALTER COLUMN blueprint_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flow_image_jobs_execution ON public.imphq_flow_image_jobs(execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flow_image_jobs_status ON public.imphq_flow_image_jobs(status, created_at);

ALTER TABLE public.imphq_wa_conversations 
  ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb;

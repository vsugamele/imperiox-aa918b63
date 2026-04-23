ALTER TABLE imphq_generated_contents 
  ADD COLUMN IF NOT EXISTS cluster_id UUID,
  ADD COLUMN IF NOT EXISTS cluster_role TEXT,
  ADD COLUMN IF NOT EXISTS source_idea TEXT;
CREATE INDEX IF NOT EXISTS idx_imphq_generated_contents_cluster ON imphq_generated_contents(cluster_id) WHERE cluster_id IS NOT NULL;
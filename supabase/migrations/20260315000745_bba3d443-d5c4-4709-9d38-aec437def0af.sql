ALTER TABLE imphq_content_library 
  ADD COLUMN IF NOT EXISTS content_category TEXT DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS publish_date DATE;
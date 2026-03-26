ALTER TABLE imphq_project_costs
  ADD COLUMN IF NOT EXISTS pix_info TEXT,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;
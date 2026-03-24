
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS pix_info TEXT;
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS plataforma TEXT;
ALTER TABLE imphq_project_costs ADD COLUMN IF NOT EXISTS produto_nome TEXT;

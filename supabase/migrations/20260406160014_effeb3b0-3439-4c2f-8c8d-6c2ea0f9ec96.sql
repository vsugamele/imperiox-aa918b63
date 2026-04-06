ALTER TABLE imphq_tools_vault ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE imphq_tools_vault ADD COLUMN IF NOT EXISTS produto text;
ALTER TABLE imphq_referencias ADD COLUMN IF NOT EXISTS pasta text;
ALTER TABLE imphq_referencias ADD COLUMN IF NOT EXISTS produto text;
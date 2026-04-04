ALTER TABLE imphq_project_costs
  ADD COLUMN IF NOT EXISTS beneficiario text,
  ADD COLUMN IF NOT EXISTS tipo_recorrencia text DEFAULT 'mensal';
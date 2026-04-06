UPDATE imphq_leads SET total_gasto = COALESCE((
  SELECT SUM(valor) FROM imphq_vendas 
  WHERE imphq_vendas.lead_id = imphq_leads.id AND status = 'aprovado'
), 0)
WHERE total_gasto > 0;
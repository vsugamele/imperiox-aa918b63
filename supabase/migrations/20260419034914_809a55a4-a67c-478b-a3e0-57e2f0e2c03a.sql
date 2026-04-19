-- Recalcular total_gasto de todos os leads baseado em vendas realmente aprovadas
UPDATE imphq_leads l
SET total_gasto = COALESCE(sub.total, 0),
    updated_at = NOW()
FROM (
  SELECT lead_id, SUM(valor) as total
  FROM imphq_vendas
  WHERE status IN ('aprovado', 'aprovada', 'approved', 'Aprovada', 'Aprovado', 'paid')
    AND lead_id IS NOT NULL
  GROUP BY lead_id
) sub
WHERE l.id = sub.lead_id
  AND COALESCE(l.total_gasto, 0) <> COALESCE(sub.total, 0);

-- Reverter status para 'lead' quando o lead foi marcado cliente mas não tem venda aprovada
UPDATE imphq_leads l
SET status = 'lead', updated_at = NOW()
WHERE l.status = 'cliente'
  AND NOT EXISTS (
    SELECT 1 FROM imphq_vendas v
    WHERE v.lead_id = l.id
      AND v.status IN ('aprovado', 'aprovada', 'approved', 'Aprovada', 'Aprovado', 'paid')
  );
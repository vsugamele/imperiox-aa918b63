-- Fix Maiara's sale: was recorded as R$74 (order total) instead of R$47 (item price)
UPDATE imphq_vendas SET valor = 47.00 WHERE id = 'd593df74-cb83-4078-b6c6-6fa24af428fb';

-- Insert the order bump as a separate sale
INSERT INTO imphq_vendas (id, lead_id, project_id, produto_nome, valor, plataforma, status, tipo_venda, data)
SELECT 
  gen_random_uuid(),
  '67eb021b-b0e0-4641-a096-c74137ac1129',
  project_id,
  'Order Bump',
  27.00,
  'Ticto',
  'aprovado',
  'orderbump',
  '{"tipo_venda": "orderbump"}'::jsonb
FROM imphq_vendas WHERE id = 'd593df74-cb83-4078-b6c6-6fa24af428fb';

-- Recalculate lead total_gasto (47 + 27 = 74, same total but now correctly split)
UPDATE imphq_leads SET total_gasto = 74.00, updated_at = NOW() WHERE id = '67eb021b-b0e0-4641-a096-c74137ac1129';
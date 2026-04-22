-- Promover os 2 PIX órfãos de hoje (Código dos Cortes Perfeitos) que tiveram webhook compra_aprovada da Ticto
UPDATE public.imphq_vendas
SET status = 'aprovado'
WHERE id IN (
  '5d908ba3-97c3-4634-9fac-9e9101c0ff55',
  'a3e6074c-f46a-43d2-9d5e-f648be5d1a43'
)
AND status = 'pix_gerado';

-- Recalcular total_gasto dos leads afetados
UPDATE public.imphq_leads l
SET total_gasto = COALESCE((
  SELECT SUM(v.valor) FROM public.imphq_vendas v
  WHERE v.lead_id = l.id AND v.status = 'aprovado'
), 0),
status = 'cliente'
WHERE l.id IN ('90f29dc7-be84-4dc9-ae67-350df3523d88', '034b242e-a383-4201-b016-1f1ff4f88a16');
-- Atualiza dedupe_hours para 24h e reduz acoes para os 3 primeiros steps
UPDATE imphq_automacoes
SET 
  dedupe_hours = 24,
  acoes = jsonb_build_array(
    acoes::jsonb -> 0,
    acoes::jsonb -> 1,
    acoes::jsonb -> 2
  )::json,
  updated_at = now()
WHERE id IN (
  'fca365b0-84b0-40b8-bfd7-cba05db8cf59', -- Pix JP
  '40a54881-1257-4ac6-a16c-0a2cc5347cc4', -- PIX - Finalização Express
  '932dbeee-6965-48c0-ac2e-0de2706d3a0d'  -- Recuperação
);
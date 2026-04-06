
-- Inserir venda da Fernanda que faltou
INSERT INTO imphq_vendas (id, lead_id, project_id, produto_nome, valor, plataforma, status, tipo_venda, created_at)
VALUES (
  gen_random_uuid()::text,
  '00b1ad95-d8cd-4e16-aee0-656edba8cf49',
  'jp_freitas',
  'Código dos Cortes Perfeitos',
  47,
  'Ticto',
  'aprovado',
  'principal',
  '2026-04-05T22:40:38.103Z'
);

-- Inserir eventos de jornada da Fernanda (PixGerado + CompraAprovada)
INSERT INTO imphq_events (id, event_name, project_id, visitor_id, page_url, event_data, utm_source, created_at)
VALUES
(
  gen_random_uuid()::text,
  'PixGerado',
  'jp_freitas',
  '00b1ad95-d8cd-4e16-aee0-656edba8cf49',
  'webhook://Ticto',
  '{"produto":"Código dos Cortes Perfeitos","valor":47,"plataforma":"Ticto","evento":"pix_created","tipo_venda":"principal"}'::jsonb,
  'fernandaoliveira5331@gmail.com',
  '2026-04-05T22:37:45.347Z'
),
(
  gen_random_uuid()::text,
  'CompraAprovada',
  'jp_freitas',
  '00b1ad95-d8cd-4e16-aee0-656edba8cf49',
  'webhook://Ticto',
  '{"produto":"Código dos Cortes Perfeitos","valor":47,"plataforma":"Ticto","evento":"compra_aprovada","tipo_venda":"principal"}'::jsonb,
  'fernandaoliveira5331@gmail.com',
  '2026-04-05T22:40:38.103Z'
);

-- Inserir evento de jornada da Ingride (PixGerado)
INSERT INTO imphq_events (id, event_name, project_id, visitor_id, page_url, event_data, utm_source, created_at)
VALUES (
  gen_random_uuid()::text,
  'PixGerado',
  'jp_freitas',
  'f4b426f2-7981-4ab4-a3c8-eb43b9961eb6',
  'webhook://Ticto',
  '{"produto":"Código dos Cortes Perfeitos","valor":47,"plataforma":"Ticto","evento":"pix_created","tipo_venda":"principal"}'::jsonb,
  'jesusdossantosingride@gmail.com',
  '2026-04-05T12:45:50.505Z'
);

-- Atualizar total_gasto da Fernanda
UPDATE imphq_leads
SET total_gasto = 47,
    updated_at = NOW()
WHERE id = '00b1ad95-d8cd-4e16-aee0-656edba8cf49';

-- Atualizar interações da Ingride
UPDATE imphq_leads
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{interacoes}',
  '[{"evento":"pix_created","data":"2026-04-05T12:45:50.505Z","produto":"Código dos Cortes Perfeitos","valor":47,"plataforma":"Ticto","tipo_venda":"principal","utms":{}}]'::jsonb
),
updated_at = NOW()
WHERE id = 'f4b426f2-7981-4ab4-a3c8-eb43b9961eb6';

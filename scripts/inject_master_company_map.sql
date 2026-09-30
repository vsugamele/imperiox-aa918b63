
-- Limpeza anterior do Mapa Principal
DELETE FROM imphq_company_map_edges WHERE map_id = '67f9f17a-e75e-45f6-a5e3-20198bfdd692';
DELETE FROM imphq_company_map_nodes WHERE map_id = '67f9f17a-e75e-45f6-a5e3-20198bfdd692';
DELETE FROM imphq_company_map_annotations WHERE map_id = '67f9f17a-e75e-45f6-a5e3-20198bfdd692';

UPDATE imphq_company_maps
SET name = '⭐ Fluxo Master da Empresa — Império HQ',
    viewport = '{"x": 0, "y": 0, "zoom": 0.85}'::jsonb,
    updated_at = NOW()
WHERE id = '67f9f17a-e75e-45f6-a5e3-20198bfdd692';

-- Inserir Annotations (Frames)
INSERT INTO imphq_company_map_annotations (id, map_id, kind, x, y, width, height, text, style, z_index)
VALUES (gen_random_uuid(), '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'frame', 30, 30, 1040, 520, '', '{"heading":"🌾 1. MÁQUINA ORGÂNICA MULTICANAL (TikTok, Reels, Shorts & GeeLark)","borderColor":"#10b981","bgColor":"rgba(16, 185, 129, 0.03)"}'::jsonb, 0);
INSERT INTO imphq_company_map_annotations (id, map_id, kind, x, y, width, height, text, style, z_index)
VALUES (gen_random_uuid(), '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'frame', 1110, 30, 1040, 520, '', '{"heading":"💈 2. ECOSSISTEMA JP FREITAS (Low Ticket & Formação Profissional)","borderColor":"#3b82f6","bgColor":"rgba(59, 130, 246, 0.03)"}'::jsonb, 0);
INSERT INTO imphq_company_map_annotations (id, map_id, kind, x, y, width, height, text, style, z_index)
VALUES (gen_random_uuid(), '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'frame', 30, 590, 1040, 520, '', '{"heading":"💊 3. SUPLEMENTOS DTC BIFI (4 Rotas de Aquisição Internacional)","borderColor":"#f59e0b","bgColor":"rgba(245, 158, 11, 0.03)"}'::jsonb, 0);
INSERT INTO imphq_company_map_annotations (id, map_id, kind, x, y, width, height, text, style, z_index)
VALUES (gen_random_uuid(), '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'frame', 1110, 590, 1040, 520, '', '{"heading":"⚙️ 4. INFRAESTRUTURA TÉCNICA CENTRAL, RASTREAMENTO & WEBHOOKS","borderColor":"#8b5cf6","bgColor":"rgba(139, 92, 246, 0.03)"}'::jsonb, 0);

-- Inserir Nós
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Ideação & Ângulos Virais', 'processo', '#10b981', 'Mineração de padrões virais e batismo do par Vilão + Solução.', '{"x":70,"y":100}'::jsonb, 'Definir ganchos 0-3s e par de mecanismos', 'agente_ia', 'angulos-criativos', NULL, '{"hook_rate_target":"35%"}'::jsonb, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Roteiro Comment-to-DM', 'doc', '#10b981', 'Roteirização segundo a segundo com retenção da solução para a DM.', '{"x":310,"y":100}'::jsonb, 'Escrever roteiro 9:16 com chamada para comentário', 'agente_ia', 'roteiros-virais-comment-to-dm', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Geração de Vídeo / Biblioteca', 'processo', '#10b981', 'Produção de Roleta, UGC e cortes com narração.', '{"x":550,"y":100}'::jsonb, 'Renderizar vídeo local ou via IA', 'hibrido', 'video-roleta-sorteio', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Farm GeeLark (Cloud Phones)', 'processo', '#f59e0b', 'Fazenda de contas TikTok/Instagram aquecidas com proxies 4G.', '{"x":790,"y":100}'::jsonb, 'Aquecer contas por 10 dias sem links na bio', 'humano', 'organic-reels-factory', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000005', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Publicação Multicontas', 'canal', '#10b981', '3 a 5 posts diários em horários de pico.', '{"x":790,"y":320}'::jsonb, 'Distribuir vídeos nas redes sociais', 'humano', NULL, NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000006', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Gatilho Comment-to-DM', 'processo', '#8b5cf6', 'Leitor comenta palavra-chave (''QUERO'') no post.', '{"x":550,"y":320}'::jsonb, 'Capturar comentário e disparar webhook', 'agente_ia', 'roteiros-virais-comment-to-dm', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000007', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Zernio Direct Messenger', 'canal', '#8b5cf6', 'Ponte de automação oficial Meta para Instagram DM.', '{"x":310,"y":320}'::jsonb, 'Enviar primeira mensagem da árvore na DM', 'agente_ia', NULL, '{"service":"zernio","endpoint":"/messages"}'::jsonb, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a1000000-0000-0000-0000-000000000008', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Atendimento X1 Automático', 'processo', '#8b5cf6', 'Árvore de 4 mensagens de qualificação e envio do link de compra.', '{"x":70,"y":320}'::jsonb, 'Fechar venda 1 a 1 no chat', 'agente_ia', 'rebel-copy', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a2000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Meta Ads (Transformação / Cortes)', 'canal', '#3b82f6', 'Campanhas de conversão no Instagram/Facebook.', '{"x":1150,"y":100}'::jsonb, 'Atrair barbeiros e cabeleireiros', 'humano', 'briefing-gestor-trafego', NULL, NULL, 'jp_freitas', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a2000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Página Código dos Cortes', 'processo', '#10b981', 'Página de vendas direta do curso de R$ 47.', '{"x":1390,"y":100}'::jsonb, 'Converter front-end impulsivo', 'agente_ia', 'tripwire-matador-v2', NULL, NULL, 'jp_freitas', 'https://codigodoscortesperfeitos.vercel.app');
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a2000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Checkout Kiwify + 2 Bumps', 'processo', '#10b981', 'Curso R$ 47 + Bump Tesoura R$ 27 + Bump Fade R$ 19,90.', '{"x":1630,"y":100}'::jsonb, 'Maximizar ticket médio (AOV ~ R$ 60)', 'humano', NULL, NULL, NULL, 'jp_freitas', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a2000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Recuperação Evolution API', 'processo', '#f59e0b', 'Disparo automático de Pix/Boleto em 15 minutos.', '{"x":1870,"y":100}'::jsonb, 'Resgatar até 35% dos pedidos abandonados', 'agente_ia', NULL, '{"service":"evolution_api","instance":"jpfreitas"}'::jsonb, NULL, 'jp_freitas', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a2000000-0000-0000-0000-000000000005', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Página Captura Formação', 'processo', '#3b82f6', 'Inscrição gratuita para o Webinar / Masterclass.', '{"x":1390,"y":320}'::jsonb, 'Coletar Nome, WhatsApp e E-mail', 'agente_ia', 'lp-persuasiva-v2', NULL, NULL, 'jp_freitas', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a2000000-0000-0000-0000-000000000006', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Obrigado + Forçar Grupo VIP', 'processo', '#3b82f6', 'Redirecionamento obrigatório para o Grupo de WhatsApp.', '{"x":1630,"y":320}'::jsonb, 'Reter mais de 75% dos inscritos no grupo', 'agente_ia', NULL, NULL, NULL, 'jp_freitas', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a2000000-0000-0000-0000-000000000007', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Webinar de Lançamento (5 Blocos)', 'processo', '#3b82f6', 'Aula magna com pitch da Formação R$ 997 a R$ 2.997.', '{"x":1870,"y":320}'::jsonb, 'Gerar pico de faturamento e autoridade', 'hibrido', 'webinar-blocks', NULL, NULL, 'jp_freitas', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a3000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Tráfego Pago Internacional', 'canal', '#ef4444', 'Campanhas agressivas de causa raiz nos EUA (Meta/TikTok).', '{"x":70,"y":660}'::jsonb, 'Gerar tráfego qualificado de alta escala', 'humano', 'angulos-criativos', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a3000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Rota 1: PDP Direta (PureLabs)', 'processo', '#06b6d4', 'Página de produto direto com kits de 1, 3 e 6 frascos.', '{"x":310,"y":660}'::jsonb, 'Conversão direta para público consciente da solução', 'agente_ia', NULL, NULL, NULL, 'slimsoda', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a3000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Rota 2: Advertorial Editorial', 'processo', '#f59e0b', 'Artigo estilo jornal investigativo (The Honey Trick / Melissa McCarthy).', '{"x":550,"y":660}'::jsonb, 'Desarmar ceticismo em tráfego nativo', 'agente_ia', 'breakthrough-techniques', NULL, NULL, 'memoflow', NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a3000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Rota 3: VSL Longa (20-35 min)', 'processo', '#8b5cf6', 'Vídeo de vendas hipnótico com botão revelado no pitch time.', '{"x":790,"y":660}'::jsonb, 'Venda emocional em massa via mecanismo único', 'agente_ia', 'mecanismo-vsl', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a3000000-0000-0000-0000-000000000005', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Rota 4: Conversão X1 (Zernio)', 'processo', '#10b981', 'Atendimento 1 a 1 com IA especializada (LinfaFlowX1 / CinnaShieldX1).', '{"x":550,"y":880}'::jsonb, 'Converter leads quentes e tirar dúvidas de saúde', 'agente_ia', 'rebel-copy', NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a3000000-0000-0000-0000-000000000006', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Checkout Internacional (Kits 1, 3 e 6)', 'processo', '#10b981', 'Página de pagamento segura com $294 no kit máximo.', '{"x":790,"y":880}'::jsonb, 'Processar pedido e emitir ordem de envio', 'humano', NULL, NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a4000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Meta Pixel & CAPI + TikTok', 'processo', '#6366f1', 'Rastreamento server-side sem perda de cookies iOS.', '{"x":1150,"y":660}'::jsonb, 'Alimentar inteligência do algoritmo com dados reais', 'agente_ia', NULL, NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a4000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Zernio API (Meta Webhooks)', 'canal', '#8b5cf6', 'Ponte oficial para Instagram DM e Facebook Messenger.', '{"x":1390,"y":660}'::jsonb, 'Receber eventos de comentários e mensagens instantâneas', 'agente_ia', NULL, NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a4000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Evolution API (WhatsApp Chips)', 'canal', '#10b981', 'Instâncias de chips com saúde monitorada a cada 10 min.', '{"x":1630,"y":660}'::jsonb, 'Envio de mensagens, áudios e recuperação de leads', 'agente_ia', NULL, NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a4000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'Webhook Central Pagamentos', 'processo', '#10b981', 'Recebimento unificado de Kiwify, Hotmart, Ticto e Stripe.', '{"x":1870,"y":660}'::jsonb, 'Notificar vendas, gerar leads e disparar integrações', 'agente_ia', NULL, NULL, NULL, NULL, NULL);
INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('a4000000-0000-0000-0000-000000000005', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'GA4, UTMs & Cockpit Executivo', 'doc', '#64748b', 'Rastreamento unificado de origem de tráfego e ROAS real.', '{"x":1390,"y":880}'::jsonb, 'Exibir dashboards em tempo real para os sócios', 'humano', NULL, NULL, NULL, NULL, NULL);

-- Inserir Conexões (Edges)
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e1000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'Roteirizar');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e1000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'Gerar Clipes');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e1000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 'Alimentar Farm');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e1000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005', 'Postar Diário');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e1000000-0000-0000-0000-000000000005', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006', 'Comentários');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e1000000-0000-0000-0000-000000000006', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000007', 'Webhook DM');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e1000000-0000-0000-0000-000000000007', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000008', 'Conversão IA');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e2000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'Rota Low Ticket');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e2000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000003', 'Comprar');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e2000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000004', 'Abandono / Pix');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e2000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000005', 'Rota Formação');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e2000000-0000-0000-0000-000000000005', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000006', 'Opt-in');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e2000000-0000-0000-0000-000000000006', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a2000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000007', 'Aquecimento');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'Frio / PDP');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'Nativo / Notícia');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000004', 'Causa Raiz');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000004', 'Assistir Vídeo');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000005', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000006', 'Pitch Time');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000006', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000006', 'Selecionar Kit');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000007', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000005', 'Mensagem');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e3000000-0000-0000-0000-000000000008', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000006', 'Link Compra');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e4000000-0000-0000-0000-000000000001', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a2000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000004', 'Venda / Carrinho');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e4000000-0000-0000-0000-000000000002', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a3000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000004', 'Order Placed');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e4000000-0000-0000-0000-000000000003', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000003', 'Boas-vindas');
INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('e4000000-0000-0000-0000-000000000004', '67f9f17a-e75e-45f6-a5e3-20198bfdd692', 'a1000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000002', 'Direct Engine');

-- OpenFlow starter templates: 5 flows prontos para uso imediato
-- Carregados no dialog "Novo Flow" via tabela imphq_flow_templates
-- NOTA: delay_min é o campo padrão do sistema (minutos inteiros)

CREATE TABLE IF NOT EXISTS imphq_flow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  trigger_tipo text NOT NULL,
  acoes jsonb NOT NULL DEFAULT '[]',
  categoria text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Garante colunas caso a tabela já existia antes desta migration
ALTER TABLE imphq_flow_templates ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE imphq_flow_templates ADD COLUMN IF NOT EXISTS slug text;

-- Evita duplicatas caso a migration seja reexecutada
DELETE FROM imphq_flow_templates WHERE nome IN (
  '🛒 Recuperação de Carrinho Abandonado',
  '💰 PIX Gerado — Urgência de Pagamento',
  '🎉 Onboarding Pós-Compra',
  '🧊 Reativação de Lead Frio',
  '↩️ Prevenção de Reembolso'
);

INSERT INTO imphq_flow_templates (slug, nome, descricao, trigger_tipo, categoria, ordem, acoes) VALUES

-- 1. Carrinho Abandonado — sequência de recuperação
(
  'recuperacao-carrinho-abandonado',
  '🛒 Recuperação de Carrinho Abandonado',
  'Sequência de 3 mensagens para recuperar leads que abandonaram o checkout. Alta taxa de conversão com urgência e prova social.',
  'carrinho_abandonado',
  'Recuperação',
  1,
  '[
    {"tipo":"whatsapp","mensagem":"Oi {{primeiro_nome}}! 👋 Vi que você estava interessado(a) em {{produto}} mas não finalizou a compra.\n\nAinda dá tempo! O seu acesso está reservado por mais 1 hora. 🕐\n\nAcesse agora: {{link}}","delay_min":0},
    {"tipo":"aguardar","delay_min":60},
    {"tipo":"whatsapp","mensagem":"{{primeiro_nome}}, o estoque de {{produto}} está acabando. 😬\n\nSão apenas as últimas vagas com o valor atual. Depois disso o preço aumenta.\n\nGarante o seu aqui 👇\n{{link}}","delay_min":0},
    {"tipo":"aguardar","delay_min":120},
    {"tipo":"whatsapp","mensagem":"Última chance! ⚡\n\nSua vaga em {{produto}} vai expirar em breve. Centenas de alunos já estão transformando seus resultados.\n\nSe tiver qualquer dúvida, me chama aqui mesmo. 😊\n\n{{link}}","delay_min":0}
  ]'::jsonb
),

-- 2. PIX Pendente — urgência máxima
(
  'pix-urgencia-pagamento',
  '💰 PIX Gerado — Urgência de Pagamento',
  'Sequência para leads que geraram PIX mas não pagaram. Foco em urgência e facilidade de pagamento.',
  'aguardando_pagamento',
  'Recuperação',
  2,
  '[
    {"tipo":"whatsapp","mensagem":"Oi {{primeiro_nome}}! Seu PIX de {{produto}} foi gerado e está aguardando pagamento. ⚡\n\nO código expira em 30 minutos. Pague agora e ganhe acesso imediato!\n\n{{link}}","delay_min":0},
    {"tipo":"aguardar","delay_min":25},
    {"tipo":"whatsapp","mensagem":"⚠️ {{primeiro_nome}}, seu PIX está prestes a expirar!\n\nFaltam apenas alguns minutos. Se tiver dificuldade para pagar, me chama aqui que ajudo. 🙏","delay_min":0},
    {"tipo":"aguardar","delay_min":60},
    {"tipo":"whatsapp","mensagem":"Seu PIX expirou, mas não se preocupe! 😊\n\nPosso gerar um novo link pra você em segundos. É só me falar e já faço isso.\n\nOu acesse diretamente: {{link}}","delay_min":0}
  ]'::jsonb
),

-- 3. Boas-vindas após compra aprovada
(
  'onboarding-pos-compra',
  '🎉 Onboarding Pós-Compra',
  'Sequência de boas-vindas para novos clientes. Garante primeiro acesso, previne churn e cria experiência premium.',
  'compra_aprovada',
  'Pós-venda',
  3,
  '[
    {"tipo":"whatsapp","mensagem":"Parabéns {{primeiro_nome}}! 🎉🎊\n\nSua compra de {{produto}} foi aprovada com sucesso!\n\nSeu acesso já está liberado. Clica no link abaixo para entrar:\n👉 {{link}}\n\nBem-vindo(a) à família! 💪","delay_min":0},
    {"tipo":"aguardar","delay_min":1440},
    {"tipo":"whatsapp","mensagem":"Oi {{primeiro_nome}}! Já deu uma olhada no {{produto}}? 😊\n\nSeparei os 3 primeiros passos que todo iniciante deve dar:\n\n1️⃣ Assista a aula de boas-vindas\n2️⃣ Acesse o grupo exclusivo de alunos\n3️⃣ Agende sua primeira sessão prática\n\nQualquer dúvida, tô aqui! 🙋","delay_min":0},
    {"tipo":"aguardar","delay_min":4320},
    {"tipo":"whatsapp","mensagem":"{{primeiro_nome}}, já faz 3 dias desde que você entrou em {{produto}}!\n\nComo está sendo sua experiência até agora? Me conta aqui. 👇\n\nSua opinião é muito importante pra gente! 💙","delay_min":0}
  ]'::jsonb
),

-- 4. Reativação de lead frio (7 dias de silêncio)
(
  'reativacao-lead-frio',
  '🧊 Reativação de Lead Frio',
  'Sequência para reengajar leads que não interagiram há mais de 7 dias. Usa curiosidade e prova social para reativar interesse.',
  'lead_novo',
  'Reativação',
  4,
  '[
    {"tipo":"aguardar","delay_min":10080},
    {"tipo":"whatsapp","mensagem":"Oi {{primeiro_nome}}! Tudo bem? 😊\n\nFaz alguns dias que não nos falamos. Só queria saber se ficou alguma dúvida sobre {{produto}} que posso te ajudar. 🙋","delay_min":0},
    {"tipo":"aguardar","delay_min":2880},
    {"tipo":"whatsapp","mensagem":"{{primeiro_nome}}, você sabia que na semana passada mais de 50 pessoas entraram em {{produto}} e já estão tendo resultados?\n\nNão quero que você fique de fora dessa transformação. O que você acha? 🤔","delay_min":0},
    {"tipo":"aguardar","delay_min":4320},
    {"tipo":"whatsapp","mensagem":"{{primeiro_nome}}, última mensagem minha, prometo! 😄\n\nEstou com uma condição especial disponível só essa semana para quem ainda não entrou em {{produto}}.\n\nSe tiver interesse, me responde com SIM que te mando os detalhes. ✅","delay_min":0}
  ]'::jsonb
),

-- 5. Prevenção de Reembolso
(
  'prevencao-reembolso',
  '↩️ Prevenção de Reembolso',
  'Sequência de tentativa de reversão após solicitação de reembolso. Entende a dor do cliente e oferece alternativas antes de conceder.',
  'reembolso',
  'Retenção',
  5,
  '[
    {"tipo":"whatsapp","mensagem":"Oi {{primeiro_nome}}! Recebi sua solicitação de reembolso de {{produto}}. 😔\n\nAntes de processar, posso te perguntar o que aconteceu? Quero entender se teve algo errado ou se posso ajudar de alguma forma.\n\nSua opinião é fundamental pra gente melhorar. 🙏","delay_min":0},
    {"tipo":"aguardar","delay_min":240},
    {"tipo":"notify_operator","template":"Lead {{nome}} solicitou reembolso de {{produto}}. Aguardando resposta para tentativa de reversão.","delay_min":0},
    {"tipo":"aguardar","delay_min":1200},
    {"tipo":"whatsapp","mensagem":"{{primeiro_nome}}, ainda posso te ajudar antes de processar o reembolso? 💙\n\nSe o problema foi falta de tempo, posso pausar seu acesso por 30 dias sem custo.\n\nSe foi outra coisa, me conta que buscamos uma solução juntos. 😊","delay_min":0}
  ]'::jsonb
);

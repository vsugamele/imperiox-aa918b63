INSERT INTO public.imphq_automacoes (id, project_id, nome, trigger_tipo, produto, provider_id, ativo, acoes, quiet_start, quiet_end, dedupe_hours) VALUES
(
  gen_random_uuid()::text, 'jp_freitas',
  'Pix Expirado — Código dos Cortes',
  'pagamento_expirado',
  'Código dos Cortes Perfeitos',
  '6effd737-7c2d-4ff2-adce-fcdbb5b81a47',
  true,
  $$[
    {"tipo":"whatsapp","delay_min":15,"template":"{{nome}}, seu Pix do {{produto}} acabou de expirar. ⏳\n\nEnquanto você adia, mais uma colega menos técnica abre a agenda cobrando o dobro. Liberei um novo link, válido pelas próximas 2h:\n\n{{link}}\n\nQualquer dúvida me chama aqui."},
    {"tipo":"whatsapp","delay_min":120,"template":"Oi, {{nome}}. JP aqui. ✂️\n\n+215 cabeleireiras já estão dentro do Código. A diferença entre elas e você nesse momento é exatamente 1 clique:\n\n{{link}}\n\nQuer que eu te ajude a pagar em outra forma?"},
    {"tipo":"email","delay_min":360,"template":"Assunto: O preço do não-decidir, {{nome}}\n\nSe você cobra R$30 abaixo do mercado e faz 4 atendimentos/semana, são R$480 por mês perdidos. R$5.760 por ano. O {{produto}} sai por menos do que você perde em 2 semanas.\n\nNovo link Pix ativo: {{link}}\n\nJP Freitas"},
    {"tipo":"whatsapp","delay_min":1440,"template":"{{nome}}, último toque. Amanhã libero sua vaga.\n\nA cabeleireira que cobra R$200 na sua cidade não é mais técnica que você — só decidiu primeiro. {{link}}"}
  ]$$::jsonb,
  8, 22, 24
),
(
  gen_random_uuid()::text, 'jp_freitas',
  'Pix Expirado — JP Hair Education',
  'pagamento_expirado',
  'JP Hair Education',
  '6effd737-7c2d-4ff2-adce-fcdbb5b81a47',
  true,
  $$[
    {"tipo":"whatsapp","delay_min":20,"template":"{{nome}}, seu Pix do {{produto}} expirou. 🚨\n\nEssa é a formação que separa quem cobra R$80 de quem cobra R$250 pelo mesmo atendimento. Não é mais técnica — é o sistema.\n\nReabri seu acesso aqui: {{link}}"},
    {"tipo":"whatsapp","delay_min":180,"template":"{{nome}}, posso parcelar pra você no cartão ou gerar Pix novo. Me diz qual prefere.\n\nLink atualizado: {{link}}"},
    {"tipo":"email","delay_min":720,"template":"Assunto: {{nome}}, não foi o pagamento — foi o medo\n\nVocê chegou até o Pix do JP Hair Education. Isso não acontece por acaso.\n\nO que trava agora é a mesma voz que te faz baixar o preço antes da cliente pedir. Quebra esse ciclo hoje: {{link}}\n\nJP Freitas"},
    {"tipo":"whatsapp","delay_min":2880,"template":"{{nome}}, última janela antes de eu fechar sua vaga no JPHE.\n\nQuem entra agora começa a próxima turma comigo direto: {{link}}"}
  ]$$::jsonb,
  8, 22, 24
),
(
  gen_random_uuid()::text, 'jp_freitas',
  'Boleto Gerado — Recuperação D+1/D+3/D+5',
  'boleto_gerado',
  NULL,
  '6effd737-7c2d-4ff2-adce-fcdbb5b81a47',
  true,
  $$[
    {"tipo":"whatsapp","delay_min":60,"template":"Oi, {{nome}}! Seu boleto do {{produto}} já está disponível. ✂️\n\nBoleto demora 1-3 dias úteis pra compensar. Se quiser acesso na hora, posso gerar Pix: me responde aqui.\n\nBoleto: {{link}}"},
    {"tipo":"whatsapp","delay_min":1440,"template":"{{nome}}, passei pra confirmar: seu boleto do {{produto}} ainda não foi pago.\n\nEnquanto ele não compensa, sua vaga não é garantida. Quer trocar por Pix? {{link}}"},
    {"tipo":"email","delay_min":4320,"template":"Assunto: {{nome}}, seu boleto vence amanhã\n\nO {{produto}} é o atalho que você pediu — mas só funciona pra quem decide.\n\nPaga aqui antes de vencer ou troca por Pix: {{link}}\n\nJP Freitas"},
    {"tipo":"whatsapp","delay_min":7200,"template":"{{nome}}, último aviso: boleto do {{produto}} vence hoje. Depois disso reabro a vaga pra lista de espera.\n\n{{link}}"}
  ]$$::jsonb,
  8, 22, 48
),
(
  gen_random_uuid()::text, 'jp_freitas',
  'Pagamento Recusado — Resgate Imediato',
  'pagamento_recusado',
  NULL,
  '6effd737-7c2d-4ff2-adce-fcdbb5b81a47',
  true,
  $$[
    {"tipo":"whatsapp","delay_min":2,"template":"{{nome}}, seu cartão recusou agora no {{produto}}. 😕\n\nNa maioria das vezes é só limite ou banco bloqueando compra online. Posso te mandar Pix instantâneo agora?\n\nLink novo: {{link}}"},
    {"tipo":"whatsapp","delay_min":30,"template":"Te chamei aqui pq não quero que você perca a vaga por causa do banco, {{nome}}.\n\nPix entra na hora: {{link}}\n\nSe preferir outro cartão, também rola pelo mesmo link."},
    {"tipo":"email","delay_min":180,"template":"Assunto: {{nome}}, seu pagamento foi recusado — não é o fim\n\n90% das recusas em curso online são bloqueio de banco, não falta de limite. Tenta de novo com Pix ou outro cartão:\n\n{{link}}\n\nQualquer coisa me responde esse email.\n\nJP Freitas"},
    {"tipo":"whatsapp","delay_min":1440,"template":"{{nome}}, ainda tá de pé sua vaga no {{produto}}. Já liberei Pix sem taxa:\n\n{{link}}"}
  ]$$::jsonb,
  8, 22, 24
);
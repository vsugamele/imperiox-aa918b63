
-- Índice de dedup para imports históricos
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_provider_msgid
  ON public.imphq_wa_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- IA Autônoma ligada para JP Freitas (closer de vendas)
INSERT INTO public.imphq_wa_ai_config (
  project_id, enabled, personality, tone, max_tokens,
  escalation_keywords, welcome_message, context_sources,
  response_delay_seconds, business_hours_only, business_hours_start, business_hours_end
) VALUES (
  'jp_freitas', true, 'vendedor', 'amigavel', 350,
  ARRAY['humano','atendente','pessoa','falar com alguém','reclamar','cancelar','reembolso','processar'],
  'Opa! 👋 Aqui é o assistente do JP Freitas. Em que posso te ajudar?',
  ARRAY['briefing','avatar','produtos','copy_arsenal','branding'],
  4, true, '08:00', '22:00'
)
ON CONFLICT (project_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- Seed de objeções clássicas (genéricas, ativas para o projeto JP)
INSERT INTO public.imphq_wa_objections (objecao, resposta_padrao, projeto_id, origem, status, score_uso)
VALUES
  ('Está caro / não tenho dinheiro agora',
   'Entendo perfeitamente. O investimento existe pra você não ficar onde está hoje. Pensa comigo: quanto custa *continuar* sem resolver isso? Posso te mostrar como parcelar pra caber no seu bolso.',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Vou pensar / depois eu vejo',
   'Tranquilo. Só me ajuda: o que especificamente você precisa pensar? Quase sempre é (1) preço, (2) tempo ou (3) se vai funcionar pra você. Posso te ajudar a destravar agora?',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Não tenho tempo',
   'Justamente por isso. O método foi feito pra quem tem rotina apertada — em poucos minutos por dia você já começa a ver resultado. Quer que eu te mostre como encaixa no seu dia?',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Será que funciona pra mim?',
   'Pergunta certa. Me conta rapidamente sua situação atual que eu te respondo com cases de gente parecida com você. Aí você decide com clareza.',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Preciso falar com meu marido / esposa',
   'Faz total sentido alinhar. Quer que eu te mande um resumo curto do que oferece e do investimento pra vocês decidirem juntos hoje?',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Já tentei outras coisas e não deu certo',
   'Te entendo. A maioria de quem chega aqui vem frustrado. A diferença está no *método* — não é mais do mesmo. Posso te explicar em 1 minuto o que muda?',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Tem garantia?',
   'Tem sim ✅ — garantia incondicional. Você testa, e se não rolar, devolve 100%. O risco é todo nosso.',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Como funciona o pagamento?',
   'Você pode pagar via Pix (com desconto) ou cartão em até 12x. Te mando o link agora pra você ver as opções?',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Manda o link',
   'Te mando agora! Só pra eu te enviar o certo: é a oferta principal ou você quer ver as opções?',
   'jp_freitas', 'seed', 'ativa', 0),
  ('Não confio em compra online',
   'Faz sentido o receio. Trabalhamos com plataforma oficial (cartão e Pix com nota fiscal) e garantia integral. Posso te mostrar comprovações e cases reais?',
   'jp_freitas', 'seed', 'ativa', 0)
ON CONFLICT DO NOTHING;

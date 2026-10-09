# OF2.1 — Faxina do OpenFlow, boas-vindas para quem pagou e lead esperando no WhatsApp

Status: Feito · 09/10/2026 (pendente: chave da Resend)

## OpenFlow

- [x] Compra aprovada toma o lugar de fluxo de recuperação ativo. Todas as automações estavam com prioridade 5: quem pagou por Pix estava no "Pix JP" e a trava entre fluxos pulava a "Aprovada - JP Freitas". 9 dos 13 compradores do JP de 03–09/10 não receberam a boas-vindas. Regra em `canPreemptFlow`.
- [x] Ao tomar o lugar, cancela o fluxo anterior só do lead em questão (antes cancelava aquele fluxo para todos os leads).
- [x] Faxina `imphq_flow_sweep_stale(24)` de hora em hora (cron `openflow-stale-sweep`): execução em "running" parada há 24 h vira "failed" com `last_error_kind = stale_running`. Fica de fora conversa de canal (Cinna/webchat) e execução esperando evento. 365 encerradas em 09/10 (jun–set).
- [x] Passo de e-mail (OF2.2): as 8 falhas da semana são "API key is invalid". A chave vem de `imphq_projects.data.email_config` do jp_freitas, com remetente `contato@clubedasbrabas.com.br` (configuração de outra marca). A área de membros do JP envia o e-mail de acesso pela Resend dela: os 13 compradores de 03–09/10 receberam "Bem-vindo(a) à JP Hair Education! Seus dados de acesso". O log do passo agora traz status HTTP, de qual cadastro veio a chave e, quando a chave é recusada, onde trocar ou que dá para tirar o passo.
- [x] Passos de e-mail tirados do fluxo "Aprovada - JP Freitas" (Vinicius, 09/10: "Pode ser"); fluxo ficou com 3 WhatsApps. Versão anterior salva em `imphq_automacao_versions` (versão 9). A execução que estava parada no e-mail do D+2 foi movida para o WhatsApp do D+3.
- [x] Boas-vindas reenviada aos 9 compradores de 03–07/10 que ficaram sem (Vinicius: "envia pra limparmos a base"): 1 primeiro, conferido no registro do WhatsApp com id do provedor, depois os outros 8 com 20 s de intervalo. 9/9 enviadas em 09/10 entre 10h30 e 10h46; seguem para D+1 e D+3.

## WhatsApp

- [x] `wa-waiting-alert` a cada 15 min (cron `wa-waiting-alert-15min`): uma mensagem no Imperio X listando leads cuja última mensagem é deles há 1–48 h, com motivo (IA desligada/pausada/ligada sem responder, com/sem responsável). Um aviso por espera, silêncio 22h–8h, para após 3 falhas de envio em 6 h. Primeiro envio 09/10 11h (2 leads do JP, 15 h e 25 h).
- [x] Clique do link de checkout enviado pelo WhatsApp: a Ticto não devolve `attr`/`xc`, mas devolve `sck`. O link passa a levar `sck=wa_<código>` (sem sobrescrever sck existente); o webhook reconhece `wa_` como código de mensagem (não campanha) e marca `clicked_at` quando o código volta.

## Limites

- "Clique" é medido quando o lead chega a gerar um evento na Ticto (Pix gerado, recusado etc.), não no toque do link.
- A ligação mensagem → venda só roda nos avisos de intenção (Pix gerado etc.); compra no cartão sem evento anterior continua casando por telefone.

## Testes

904/904, typecheck e lint limpos. Novos: `canPreemptFlow`, `wa-waiting.test.ts`, `clicked_at` e `sck` em `sale-attribution.test.ts`, `extractUtms` com `wa_`.

## File List

supabase/functions/openflow-executor/index.ts; supabase/functions/_shared/wa-waiting.ts; supabase/functions/wa-waiting-alert/index.ts; supabase/functions/_shared/attribution.ts; supabase/functions/webhook-pagamento/index.ts; supabase/functions/webhook-pagamento/index.test.ts; supabase/migrations/20261009_imphq_flow_stale_sweep.sql; supabase/migrations/20261009_imphq_wa_waiting_alert_cron.sql; src/test/quality-backend.test.ts; src/test/sale-attribution.test.ts; src/test/wa-waiting.test.ts; docs/stories/OF2.1-faxina-openflow-e-lead-esperando.md.

# Story JP2.1 — Ninguém espera acesso no JP

**Status:** Done · **Data:** 2026-10-08

## Contexto
Alunos do JP reclamavam de acesso no direct e no WhatsApp e ficavam dias sem resposta: o link mágico estava quebrado
(0 de 26 usados em 60 dias), bumps da Ticto nunca chegavam à área de membros e o "registrei para a equipe" ia para um
sininho sem leitura. Decisão do Vinicius (08/10): quem diz que tem vitalício entra no plano da formação sem prazo; tudo
que estiver esperando deve ser resolvido sem depender dele.

## Critérios de aceite
- [x] `areamembrojp-magic-verify` corrigido (e-mail pela Admin API, sessão criada no servidor); testado com conta real
- [x] Regra do vitalício na IA (WhatsApp e Instagram): plano Premium sem prazo, conta criada se faltar, registrado em "A IA fez"
- [x] Segredo do Corte liberável pela IA
- [x] `imphq_jp_access_gaps` + função `jp-access-sweep`: toda compra aprovada (principal ou bump) sem acesso é liberada; cron diário 07:40 BRT
- [x] Varredura inicial: 27 acessos liberados (21 bumps, 6 principais; 3 contas criadas), 0 pendentes
- [x] Função `jp-support-resolve`: responde quem espera (link que funciona, vitalício, pedido de e-mail ou "não achei compra"), uma vez a cada 12h por conversa
- [x] Conversas esperando resolvidas: 7 respondidas; 1 (fora da janela de 24h do Instagram) liberada e a IA manda o link quando ela escrever
- [x] Feed "A IA fez": tipos grantAccessSilent e supportReply

## File List
- supabase/functions/areamembrojp-magic-verify/index.ts
- supabase/functions/_shared/jp-verified-grant.ts, crmBridgeJP.ts, jp-access-sweep.ts, jp-support-resolve.ts, ai-feed.ts
- supabase/functions/jp-access-sweep/index.ts, jp-support-resolve/index.ts
- supabase/functions/instagram-webhook/index.ts, wa-ai-reply/index.ts
- supabase/migrations/20261008_imphq_jp_access_sweep.sql
- src/test/jp-verified-grant.test.ts, jp-access-sweep.test.ts, jp-support-resolve.test.ts

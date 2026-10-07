# Story OP1.4 — Custo por automação

Decisão do Vinicius (03/10/2026): medir pelos dois lados — total real na conta de cada provedor e registro por chamada, em lotes; a diferença aparece como "não atribuído".
Ponto de partida: 101 functions chamam IA; só 4 registravam custo (`wa-ai-reply` em `imphq_wa_ai_logs`; `agent-autofill`, `channel-ai-reply` e `cinna-shield-x1` pelo `ai-call.ts`).

## Parte 1 — Conta de cada provedor (feito em 04/10)
- [x] `imphq_provider_usage_daily` (uma linha por provedor e dia; nunca chave). Migração `20261004_imphq_provider_usage.sql`, aplicada.
- [x] `_shared/provider-usage.ts` (endpoints conferidos na doc oficial): OpenRouter `GET /api/v1/key` (usage_daily/weekly/monthly), ElevenLabs `GET /v1/user/subscription` (caracteres do ciclo), Kie `GET /api/v1/chat/credit` (saldo). Sem API de consumo com a chave comum: gateway do Lovable e OpenAI.
- [x] Function `provider-usage-sync` publicada; agendada de hora em hora aos 55 min (job 125, migração `20261004_schedule_provider_usage_sync.sql`; chave pública copiada de outra rotina dentro do banco).
- [x] 1ª leitura (04/10): OpenRouter US$ 3,27 na semana (US$ 53,53 no total da conta); ElevenLabs starter 224/30.000 caracteres (renova 03/11); Kie 317 créditos.

## Parte 2 — Registro por chamada (em andamento)
- [x] `_shared/ai-usage.ts`: `installAiUsageTracking("nome")` envolve o fetch global; só chamadas a OpenRouter, Lovable, OpenAI, Anthropic, Google, ElevenLabs, Kie e Luma; lê tokens, modelo e custo (quando o provedor informa) e grava em `imphq_ai_usage` em segundo plano; nunca prompt, resposta ou chave; falha ao registrar não afeta a chamada.
- [x] Lote 1 no código (10 functions, conferidas idênticas ao que estava no ar antes de mexer; Deno check 0 erro antes e depois): hot-lead-responder, wa-ai-decide-escalation, wa-learn-from-sale, wa-pitch-followup, wa-consultive-followup, instagram-followup-scheduler, instagram-webhook, wa-ai-conv-scoring, wa-ai-detect-gaps, nurture-auto-segment.
- [x] Publicada a 1ª do lote (`wa-ai-decide-escalation`) para validar com tráfego real.
- [x] Publicadas também `wa-ai-detect-gaps` e `wa-ai-conv-scoring` (04/10). Chamadas à mão: as três estavam sem trabalho (`no_enabled_configs`, `no_pending_msgs`, `no_candidates`), então ainda não houve chamada de IA para registrar. A escalação (`wa-ai-decide-escalation`) está desligada em todos os projetos.
- [x] Publicadas as outras 7 em 04/10 às 14:37 UTC (autorização do Vinicius): hot-lead-responder, wa-learn-from-sale, nurture-auto-segment, wa-consultive-followup, wa-pitch-followup, instagram-followup-scheduler e instagram-webhook. Antes, o código no ar foi conferido igual ao do repositório fora as 3 linhas do registrador (a publicação em lote de outra sessão em 03/10 19:02 não tinha mudanças a preservar).
- [x] Confirmado em 07/10: `instagram-webhook` com 121 chamadas registradas (OpenRouter com custo real) e DMs entrando normalmente.
- [x] Lote 2 (07/10): as 89 functions restantes que chamam IA ganharam `installAiUsageTracking` (agora 99 de 102 cobertas; as outras 3 usam `ai-call.ts`, que já registra). Antes de publicar, a versão no ar de cada uma foi baixada e comparada com o HEAD: 89 idênticas (o `openflow-executor` só pelo `index.ts`; a CLI recusa extrair um arquivo importado de fora da pasta). Sintaxe das 89 conferida pelo parser do TypeScript; `deno check` igual antes/depois em wa-ai-reply, copilot-imperius, creative-factory, studio-generate e whatsapp-api. Publicadas em 7 lotes, todos "Deployed Functions"; `ref-pipeline` registrou as primeiras chamadas às 14:10 UTC.
- [x] Custo estimado no banco (07/10): `imphq_ai_model_prices` (preço de lista por 1M tokens, conferido contra o custo real do OpenRouter: gpt-4o-mini e gemini-3-flash-preview bateram até a 6ª casa) + gatilho `imphq_ai_usage_fill_cost` que preenche `cost_usd` quando chega vazio e marca `custo_estimado`; linhas antigas preenchidas. Vale para todas as functions sem republicar e permite atualizar preço sem deploy. Migração `20261007_imphq_ai_model_prices.sql`.
- [ ] Modelos fora da tabela seguem sem custo: incluir quando aparecerem (consultar `select model, count(*) from imphq_ai_usage where coalesce(cost_usd,0)=0 group by 1`).
- [ ] Observado em 07/10 (não causado pela publicação): desde 06/10 à tarde o bot do WhatsApp responde pouco frente às mensagens de leads (ex.: 00h UTC, 21 mensagens e 0 respostas; último log de `wa-ai-reply` às 12:25 UTC, antes das publicações). Investigar configuração/pausa do bot.

## Sala de máquinas
- [x] `imphq_machine_room()` ganhou `provedores`; alertas: OpenRouter hoje/semana e quanto da semana está sem automação registrada (04/10: US$ 3,08 de US$ 3,27), ElevenLabs % do ciclo (70% atenção, 90% erro), Kie saldo baixo (< 50), leitura atrasada (> 3 h).

## Testes
- `src/test/ai-usage.test.ts` (formatos por provedor, registro em segundo plano sem alterar a resposta, hosts que não são IA, leitura dos provedores) e `src/test/machine-room.test.ts`. Harness `quality-backend.test.ts` recebe `installAiUsageTracking` vazio.

## File List
- supabase/migrations/20261004_imphq_provider_usage.sql
- supabase/migrations/20261004_schedule_provider_usage_sync.sql
- supabase/migrations/20261003_imphq_machine_room.sql
- supabase/functions/_shared/provider-usage.ts
- supabase/functions/_shared/ai-usage.ts
- supabase/functions/_shared/machine-room.ts
- supabase/functions/provider-usage-sync/index.ts
- supabase/functions/{hot-lead-responder,wa-ai-decide-escalation,wa-learn-from-sale,wa-pitch-followup,wa-consultive-followup,instagram-followup-scheduler,instagram-webhook,wa-ai-conv-scoring,wa-ai-detect-gaps,nurture-auto-segment}/index.ts
- src/test/ai-usage.test.ts
- src/test/machine-room.test.ts
- src/test/quality-backend.test.ts
- docs/stories/OP1.4-custo-por-automacao.md

# Story JP1.1 — Corrigir atendimento JP no WhatsApp e Instagram

Status: Concluída e publicada em 30/09/2026. Autorização: usuário escolheu correção completa em 30/09/2026.
Escopo: causas documentadas na auditoria de conversas; consumo de ElevenLabs tem investigação separada.
Responsáveis: @dev implementação, @qa validação, @devops publicação.

## Critérios e progresso

- [x] Conferir fontes existentes, schema e contrato publicado do CRM.
- [x] Catálogo disponível completo, preços brasileiros e downsell inferior ao original.
- [x] Regras mandatórias sem truncamento; links separados por intenção; identidade de assistente.
- [x] Recuperação de acesso verificada e encaminhamento persistido em falha.
- [x] Ingestão Instagram idempotente, histórico deduplicado e trava atômica por conversa.
- [x] Mensagens próximas preservadas; follow-ups respeitam pausa, concorrência e contexto.
- [x] Validar um cenário isolado antes do conjunto; lint, typecheck e testes.
- [x] Commit com story ID, deploy e verificação de versões publicadas.
- [x] Handoff com limites e próximos passos.

## File List

- docs/stories/JP1.1-tratamento-conversas.md
- supabase/functions/_shared/conversation-policy.ts
- supabase/functions/_shared/crmBridgeJP.ts
- supabase/functions/_shared/database-port.ts
- supabase/functions/_shared/embeddings.ts
- supabase/functions/_shared/leadDataExtractor.ts
- supabase/functions/_shared/ig-reply-lease.ts
- supabase/functions/wa-ai-reply/index.ts
- supabase/functions/wa-pitch-followup/index.ts
- supabase/functions/instagram-webhook/index.ts
- supabase/functions/instagram-api/index.ts
- supabase/functions/zernio-webhook/index.ts
- supabase/functions/instagram-followup-scheduler/index.ts
- supabase/migrations/20260930150225_jp_conversation_policy.sql
- supabase/tests/jp-conversation-policy.sql
- src/test/conversation-policy.test.ts
- src/test/jp-access-recovery.test.ts
- src/test/quality-backend.test.ts
- src/test/jp-crm-server.test.ts
- supabase/functions/crm-bridge/index.ts
- docs/sessions/2026-09/2026-09-30-jp-correcao-conversas.md

## Evidência

Referência: docs/sessions/2026-09/2026-09-30-jp-auditoria-conversas-ia.md.
CRM publicado usa `exists` e `entitlements`; consumidor usava `has_account`/`user_exists`.
Histórico existente será preservado. Validação operacional não envolve enviar mensagens a leads.

Validação: cenário monetário isolado; 32 testes específicos de catálogo/recuperação/CRM; 467 testes passaram no conjunto final (66 arquivos); lint sem erros (2 avisos anteriores), typecheck e Deno check das sete funções. Migração aplicada; integração SQL passou com rollback integral. Nenhum envio ou geração de acesso para lead real durante a validação.

Causa adicional confirmada: CRM v7 retornava HTTP 503 porque exigia areamembrojp_settings.crm_bridge_secret, ausente no banco. JPFREITAS_CRM_BRIDGE_SECRET existe no ambiente. Reaproveitada a função publicada com leitura do segredo do ambiente e fallback compatível para o banco. O fallback de auth.admin.getUserByEmail, inexistente no SDK usado, foi substituído por listUsers paginado. Sem alteração de segredo ou liberação de acesso.

Consulta por telefone compatível com o consumidor WhatsApp foi implementada na função CRM. Chamadas internas com credencial service_role exata são autenticadas; JWTs administrativos diferentes precisam de validação efetiva no PostgREST do mesmo projeto. A declaração de papel no token não basta. Clientes externos continuam usando x-crm-secret. Credenciais inválidas recebem 401.

Publicação: instagram-api v310, instagram-webhook v310, zernio-webhook v272, instagram-followup-scheduler v273, wa-ai-reply v309, wa-pitch-followup v141 e crm-bridge v9, todas ACTIVE. Conteúdo publicado e dependências conferidos contra os arquivos locais. Migração 20260930150225 aplicada.

Consulta real somente de leitura ao CRM: HTTP 200, conta encontrada e dois acessos cadastrados; chamada sem credencial: HTTP 401. Não foi emitido token real nem realizado login de aluno; esse ciclo completo depende de um atendimento legítimo posterior.

Commits de implementação: fa4506fc, b5590bc3 e ff35ee1e. Handoff final: docs/sessions/2026-09/2026-09-30-jp-correcao-conversas.md.

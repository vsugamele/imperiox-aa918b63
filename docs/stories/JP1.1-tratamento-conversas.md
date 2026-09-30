# Story JP1.1 — Corrigir atendimento JP no WhatsApp e Instagram

Status: Em implementação. Autorização: usuário escolheu correção completa em 30/09/2026.
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
- [ ] Commit com story ID, deploy e verificação de versões publicadas.
- [ ] Handoff com limites e próximos passos.

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

## Evidência

Referência: docs/sessions/2026-09/2026-09-30-jp-auditoria-conversas-ia.md.
CRM publicado usa `exists` e `entitlements`; consumidor usava `has_account`/`user_exists`.
Histórico existente será preservado. Validação operacional não envolve enviar mensagens a leads.

Validação: cenário monetário isolado; 30 testes específicos de catálogo/recuperação; 465 testes passaram no conjunto final (66 arquivos); lint sem erros (2 avisos anteriores), typecheck e Deno check das seis funções. Migração aplicada; integração SQL passou com rollback integral. Nenhum envio ou geração de acesso para lead real.

Causa adicional confirmada: CRM v7 retornava HTTP 503 porque exigia areamembrojp_settings.crm_bridge_secret, ausente no banco. JPFREITAS_CRM_BRIDGE_SECRET existe no ambiente. Reaproveitada a função publicada com leitura do segredo do ambiente e fallback compatível para o banco. O fallback de auth.admin.getUserByEmail, inexistente no SDK usado, foi substituído por listUsers paginado. Sem alteração de segredo ou liberação de acesso.

Consulta por telefone compatível com o consumidor WhatsApp foi implementada na função CRM. Chamadas internas com credencial exata service_role são autenticadas; credenciais inválidas continuam recebendo 401. Clientes externos continuam usando x-crm-secret. Deploy adicional e consulta real somente de leitura seguem para verificação.

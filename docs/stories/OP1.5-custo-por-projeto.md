# OP1.5 — Custo de IA atribuído por chamada e projeto

Status: Em andamento · 04/10/2026
Escopo autorizado: opção 1 da revisão dos itens 5/6. Implementação @dev, schema @data-engineer, testes @qa, publicação @devops. Papéis executados nesta sessão; sem subagentes acionados.

## Critérios

- [x] Conferir estruturas existentes, código publicado e schema completo das tabelas envolvidas.
- [x] Reproduzir atribuição incorreta em chamadas simultâneas; conferir 11 registros reais sem projeto.
- [x] Substituir projeto global por contexto explícito imutável por chamada.
- [x] Informar projeto nas nove automações que possuem esse contexto; a décima (nurture-auto-segment) permanece compartilhada, sem atribuição inventada. Prompts/destinatários preservados.
- [x] Registrar consumo desconhecido como null, preservando custos informados pelo provedor.
- [x] Detectar falhas de gravação sem derrubar o atendimento ou expor dados sensíveis.
- [x] Validar concorrência, ausência de consumo, falha do logger e resposta original.
- [x] Passar lint, typecheck e testes na cópia isolada; conferir fonte publicada antes do deploy.
- [x] Aplicar migração, validar aceitação de null com rollback, publicar piloto e conferir boot HTTP 200/código; repetir nas demais.
- [x] Conferir a primeira chamada natural com projeto após o deploy (não forçar mensagem/custo).
- [ ] Registrar handoff com evidência de produção e limites da atribuição histórica.

Não atribuir chamadas antigas por horário ou por suposição. Não executar mensagens de teste em clientes nem chamadas pagas para validação. OP1.4 contém trabalho concorrente e será preservada.

## File List

- supabase/functions/_shared/ai-usage.ts
- src/test/ai-usage.test.ts
- supabase/migrations/20261004_ai_usage_nullable_consumption.sql
- docs/stories/OP1.5-custo-por-projeto.md

## Evidência parcial

691 testes passaram (105 arquivos), incluindo resposta/concorrência/logger. Deno: dez funções passaram. A cópia isolada preserva trabalho paralelo com erros de lint/tipos. Tipos atualizados conforme schema real de imphq_profiles; inferência da biblioteca limitada à tabela consultada; assinatura do mock de conta e tipo opcional do projeto no alerta de anúncios corrigidos para destravar o quality gate. Sem alteração de dados ou comportamento nesses ajustes.

### Arquivos adicionais
- supabase/functions/_shared/embeddings.ts
- src/pages/CustosIA.tsx
- src/integrations/supabase/types.ts
- src/test/custos-ia.test.tsx
- src/test/quality-backend.test.ts
- src/components/referencias/ReferenceLibraryView.tsx
- src/test/empresa-accounts.test.tsx
- supabase/functions/_shared/machine-room.ts
- supabase/functions/instagram-webhook/index.ts
- supabase/functions/instagram-followup-scheduler/index.ts
- supabase/functions/hot-lead-responder/index.ts
- supabase/functions/wa-learn-from-sale/index.ts
- supabase/functions/wa-consultive-followup/index.ts
- supabase/functions/wa-pitch-followup/index.ts
- supabase/functions/wa-ai-decide-escalation/index.ts
- supabase/functions/wa-ai-conv-scoring/index.ts
- supabase/functions/wa-ai-detect-gaps/index.ts
- supabase/functions/nurture-auto-segment/index.ts

## Produção OP1.5

Migração ai_usage_nullable_consumption aplicada. Transação de aceitação com null revertida; zero linhas de teste persistentes. Dez funções ACTIVE; fontes remotas conferidas arquivo por arquivo; OPTIONS HTTP 200 em todas. Versões: instagram-webhook 337; instagram-followup-scheduler 300; hot-lead-responder 362; wa-learn-from-sale 220; wa-consultive-followup 98; wa-pitch-followup 169; wa-ai-decide-escalation 260; wa-ai-conv-scoring 260; wa-ai-detect-gaps 262; nurture-auto-segment 347. verify_jwt original preservado.

13 linhas históricas sem projeto (9 webhook e 4 scheduler) preservadas, sem atribuição retroativa. Primeira prova natural após publicação: webhook às 22:42:23 UTC, jp_freitas, 4396 tokens, USD 0.000665; scheduler às 22:50:03 UTC, jp_freitas, 3693 tokens, USD 0.000565. Consumo/projeto gravados sem disparar testes pagos ou mensagens. Cards de tokens também distinguem consumo desconhecido de zero e sinalizam total parcial.

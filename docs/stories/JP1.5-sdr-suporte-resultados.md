# Story JP1.5 — SDR, suporte e resultados verificáveis

Responsáveis: @dev (fluxos), @data-engineer (persistência), @qa (validação), @devops (publicação).
Direção aprovada: evolução completa da conversa JP em WhatsApp e Instagram.

## Critérios de aceitação
- [x] Separar assunto atual, urgência operacional e intenção comercial; preço sozinho não é compra quente.
- [x] Qualificação progressiva sem bloquear preço/link; benefício pelo problema, objeções com escuta e recusa respeitada.
- [x] Histórico do canal correto; fatos com evidência, data e origem; pendências preservadas sem dominar novo assunto.
- [x] Suporte com responsável, ação e confirmação; gerar/enviar link não equivale a login concluído.
- [x] Registro idempotente; sem somar reclamação/saudação ao score comercial e sem alterar scores históricos.
- [x] Medição de pagamento aprovado; reaproveitar aplicações/regras A/B e disponibilizar relatório CLI sem afirmar causalidade.
- [ ] Validar um caso real anonimizado antes do conjunto; lint, tipos, testes e Deno; publicar e verificar fonte ao vivo.

## Escopo e proteção
Somente JP. Catálogo, persona, travas de áudio, outros projetos e histórico existente preservados. Nenhuma mensagem de teste a leads. Novos estados acessíveis somente pelo serviço. Arquivos preexistentes de playbooks pertencem a outra tarefa.

## File List
- docs/stories/JP1.5-sdr-suporte-resultados.md
- supabase/functions/_shared/jp-service-policy.ts
- src/test/jp-service-policy.test.ts
- supabase/migrations/20261002111544_jp_service_decisions.sql
- supabase/migrations/20261002111753_jp_support_event_order.sql
- supabase/functions/_shared/jp-service-store.ts
- supabase/functions/_shared/conversation-policy.ts
- supabase/functions/_shared/crmBridgeJP.ts
- supabase/functions/wa-ai-triage/index.ts
- supabase/functions/wa-ai-reply/index.ts
- supabase/functions/instagram-webhook/index.ts
- supabase/functions/instagram-followup-scheduler/index.ts
- supabase/functions/wa-pitch-followup/index.ts
- supabase/functions/wa-rules-evaluate-ab/index.ts
- scripts/jp-conversation-report.sql
- scripts/jp-conversation-regression.sql
- src/test/jp-access-recovery.test.ts

## Estado
Implementação concluída; publicação pendente. Migrações aplicadas; replay SQL em transação com rollback validou idempotência, ação de acesso aguardando confirmação, confirmação e evento atrasado. Replay de pagamento em cópia temporária de venda real validou Pix sem conversão, aprovação em UPDATE e repetição sem dupla contagem. Testes completos: 583/583 em 84 arquivos; tipos e Deno passaram; lint sem erros e dois warnings preexistentes.

Limites: o novo score é sinal do turno, não probabilidade de compra. Fit sem evidência permanece desconhecido e não vira qualificação confirmada. Memória anterior não foi apagada/reclassificada. Vendas associadas a regras não provam causalidade. Confirmação de suporte é relato explícito do aluno, não telemetria independente de login. Nenhum contato/teste foi enviado a leads. Promoção automática de regras JP aguarda revisão semântica e relatório de pagamentos com a política nova.

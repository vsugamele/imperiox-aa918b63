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
- [x] Validar um caso real anonimizado antes do conjunto; lint, tipos, testes e Deno; publicar e verificar fonte ao vivo.

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
Implementação publicada e fonte verificada em 2026-10-02. Migrações aplicadas; replay SQL em transação com rollback validou idempotência, ação de acesso aguardando confirmação, confirmação, evento atrasado, fonte Instagram e rejeição de canal errado. Replay de pagamento em cópia temporária de venda real validou Pix sem conversão, aprovação em UPDATE e repetição sem dupla contagem. Testes completos: 583/583 em 84 arquivos; tipos e seis funções Deno passaram; lint sem erros e dois warnings preexistentes. Commit de implementação: 947d6cc5.

Produção ACTIVE, todas as fontes e dependências equivalentes aos arquivos locais: wa-ai-triage v340, wa-ai-reply v322, instagram-webhook v321, wa-pitch-followup v153, instagram-followup-scheduler v284, wa-rules-evaluate-ab v151. RLS e privilégios das duas tabelas novos verificados: sem leitura anon/authenticated, acesso service_role. Replays deixaram zero eventos/estados de teste após rollback. Handoff: docs/sessions/2026-10/2026-10-02-jp-sdr-suporte-resultados.md.

Limites: o novo score é sinal do turno, não probabilidade de compra. Fit sem evidência permanece desconhecido e não vira qualificação confirmada. Memória anterior não foi apagada/reclassificada. Vendas associadas a regras não provam causalidade. Confirmação de suporte é relato explícito do aluno, não telemetria independente de login. Nenhum contato/teste foi enviado a leads. Promoção automática de regras JP aguarda revisão semântica e relatório de pagamentos com a política nova.

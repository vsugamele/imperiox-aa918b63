# CSX1.8 — Métricas por etapa e histórico da conversa

Pedido: ver desempenho de cada etapa e consultar até onde cada lead conversou. Liderança @dev; publicação @devops. Opções apresentadas: 1. métricas + histórico (selecionada); 2. métricas; 3. histórico.

Reutilizar imphq_flow_executions, snapshots nativos e imphq_channel_messages. Sem tabela, migração, alterações de oferta ou ativação. Analytics por conversa/execução, sem confundir checkout enviado com compra. Etapa alcançada exige evidência de execução; avanço da política não comprova entrega da próxima etapa. Registrar decisões confirmadas sem duplicar texto de saúde em logs. Histórico preserva a versão executada, inclusive após editar o roteiro. Permissões autenticadas existentes preservadas.

- [x] Conferir código, schema completo das três tabelas, políticas e volume real (zero execuções Cinna).
- [x] Registrar eventos de resposta após entrega confirmada, deduplicados por ID.
- [x] Métricas de alcance, resposta, avanço, espera e encaminhamento por etapa; definição e cobertura explícitas.
- [x] Lista de conversas, etapa/status/datas e mensagens históricas paginadas com mídia.
- [x] Testar duplicação, versões, falha de envio, terminal, paginação/erros; lint/typecheck/test/build/Deno.
- [ ] Publicar, verificar ambos hosts e função; handoff.

File List: docs/sessions/2026-09/cinna-stage-metrics-history.md.

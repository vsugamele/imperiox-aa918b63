---
name: Performance do banco imphq
description: Índices, arquivamento de webhook logs e regras de leitura para manter o Postgres rápido
type: feature
---

- `imphq_ig_webhook_logs`: dedup do Zernio usa índices de expressão `idx_ig_wh_logs_msgid_data` (payload->data->message->>id) e o equivalente em payload->message->>id. Nunca usar `.or()` misto nesses campos (não usa índice); fazer duas queries em paralelo + janela de 2 dias.
- Arquivamento: `imphq_ig_webhook_logs_archive` + `imphq_archive_webhook_logs()` (security definer, só service_role), cron diário `imphq-archive-webhook-logs` às 04:15 UTC (job 96). Move processados > 14 dias, purga arquivo > 90 dias. Rodar manualmente em lotes de ~4000 (7000 dá timeout).
- Nunca `select *` em `imphq_leads` (tabela quente, milhões de leituras) nem em `imphq_wa_knowledge` (coluna `embedding` gorda). Sempre lista explícita de colunas.
- `imphq_leads` NÃO tem colunas `name`, `telefone` nem `produto`; o nome é `nome`.
- `imphq_wa_knowledge`: ~22 mil linhas, 1 único índice ivfflat (`idx_wa_knowledge_embedding`) — o duplicado `imphq_wa_knowledge_embedding_idx` (87 MB, 0 uso) foi removido. Índices `idx_wa_knowledge_source_btree` (text_pattern_ops) e `idx_wa_knowledge_project_source_btree`. Tabela caiu de 409 MB → 210 MB com `REINDEX` + `VACUUM FULL`.
- Manutenção periódica: checar `pg_stat_user_indexes` com `idx_scan = 0` e remover índices mortos; `REINDEX`/`VACUUM FULL` em tabelas com embeddings resolve bloat (não criar índice novo antes de medir).
- `imphq_wa_triage`: usar `idx_wa_triage_created_desc` (filtro por `created_at`), nunca `select *`.
- Webhooks: nunca fazer UPDATE filtrando por `payload->>id` (varredura completa) — guardar o id da linha de log e atualizar por `id`.
- `wa-ai-reply`: o lead é lido uma única vez por mensagem (`leadRow` reaproveitado no bloco de contexto comportamental).
- Polling do front: mínimo 180s e pular quando `document.hidden`.

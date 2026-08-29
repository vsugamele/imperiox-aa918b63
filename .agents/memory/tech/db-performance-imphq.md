---
name: Performance do banco imphq
description: Índices, arquivamento de webhook logs e regras de leitura para manter o Postgres rápido
type: feature
---

- `imphq_ig_webhook_logs`: dedup do Zernio usa índices de expressão `idx_ig_wh_logs_msgid_data` (payload->data->message->>id) e o equivalente em payload->message->>id. Nunca usar `.or()` misto nesses campos (não usa índice); fazer duas queries em paralelo + janela de 2 dias.
- Arquivamento: `imphq_ig_webhook_logs_archive` + `imphq_archive_webhook_logs()` (security definer, só service_role), cron diário `imphq-archive-webhook-logs` às 04:15 UTC (job 96). Move processados > 14 dias, purga arquivo > 90 dias. Rodar manualmente em lotes de ~4000 (7000 dá timeout).
- Nunca `select *` em `imphq_leads` (tabela quente, milhões de leituras) nem em `imphq_wa_knowledge` (coluna `embedding` gorda). Sempre lista explícita de colunas.
- `imphq_leads` NÃO tem colunas `name`, `telefone` nem `produto`; o nome é `nome`.
- `imphq_wa_knowledge`: índice ivfflat com `lists=10`; índices em (project_id, source) e source text_pattern_ops.
- Polling do front: mínimo 180s e pular quando `document.hidden`.

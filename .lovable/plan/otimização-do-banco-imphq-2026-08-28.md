# Otimização do banco imphq_*

## O que a análise mostrou (medido agora)

Ranking por tempo total no Postgres (pg_stat_statements):

| Consulta | Chamadas | Média | Total |
|---|---|---|---|
| `imphq_ig_webhook_logs` filtrando por `payload->...->>id` (dedup do Zernio) | 7.695 | 325 ms | 41 min |
| `imphq_leads` por `id` (`select *`) | 2.696.622 | 0,9 ms | 41 min |
| `imphq_wa_knowledge` por `source` (`= ANY` e `like`) | 348 | ~2.660 ms | 15 min |
| `imphq_automacoes` select completo sem filtro | 35.166 | 9 ms | 5,4 min |
| `imphq_wa_messages` última msg por conversa | 30.436 | 8,6 ms | 4,3 min |

Tamanhos: `imphq_wa_knowledge` = 63 MB de heap + ~259 MB de índices para apenas 1.157 linhas (índice ivfflat de embedding domina). `imphq_ig_webhook_logs` = 25.171 linhas / 34 MB, com índice apenas em `created_at`.

Causas confirmadas:
- `supabase/functions/zernio-webhook/index.ts` (linhas 64-77) faz dedup com `.or("payload->data->message->>id.eq...")` — não existe índice de expressão nem GIN em `payload`, então cada webhook faz varredura completa dos 25 mil logs.
- `supabase/functions/openflow-executor/index.ts` (linha 566) refaz `select *` em `imphq_leads` por passo do fluxo, gerando os 2,7 milhões de chamadas.
- `supabase/functions/wa-behavioral-triggers/index.ts` lê `imphq_automacoes` inteiro a cada rodada de cron.
- Consultas de `imphq_wa_knowledge` filtram por `source` sem índice, varrendo linhas gordas (embedding).

## O que será feito

### 1. Índices (migração)
- `imphq_ig_webhook_logs`: índices de expressão para os dois caminhos de dedup (`payload->'data'->'message'->>'id'` e `payload->'message'->>'id'`), combinados com `event_type`/`processed`.
- `imphq_wa_knowledge`: índice em `(project_id, source)` e índice em `source` com padrão de prefixo (`text_pattern_ops`) para o `like`.
- `imphq_wa_messages`: já existe `(conversation_id, created_at DESC)`; adicionar índice parcial por `direction` para a consulta de última mensagem enviada.

### 2. Redução de leitura no código
- **Dedup do Zernio**: trocar o `.or(...)` por consulta única no campo indexado, com janela de tempo (`created_at >= now() - 1 dia`), reaproveitando o utilitário `_shared/webhook-dedup.ts` quando aplicável.
- **openflow-executor**: buscar o lead uma vez por execução e reutilizar em memória (cache local no handler), em vez de `select *` por passo; trocar `select *` por lista explícita de colunas.
- **wa-behavioral-triggers**: filtrar `imphq_automacoes` por `ativo = true` e só os campos usados.
- **Polling do front**: subir `useFlowStats` de 60 s para 180 s e alinhar os demais intervalos de polling de leads/automações, mantendo refetch ao focar a aba.

### 3. Arquivamento de logs de webhook
- Nova tabela `imphq_ig_webhook_logs_archive` (mesmo formato) + função `imphq_archive_webhook_logs()` que move registros processados com mais de 14 dias e apaga do arquivo o que passa de 90 dias.
- Agendar por `pg_cron` diariamente (madrugada).
- Rodar a primeira limpeza agora e um `VACUUM`/reindex da tabela.

### 4. Espaço do `imphq_wa_knowledge`
- Reduzir o índice ivfflat (`lists=100` é excessivo para ~1,2 mil linhas) recriando com `lists=10`, o que deve devolver a maior parte dos ~259 MB de índice.
- Ajustar as consultas para nunca trazer a coluna `embedding` quando não é usada.

## Detalhes técnicos

- Índices via migração com `CREATE INDEX` simples (sem `CONCURRENTLY`, que não roda em transação de migração).
- Antes e depois de cada índice novo: `EXPLAIN (ANALYZE, BUFFERS)` para confirmar uso real.
- O arquivamento usa função `security definer` com `search_path = public`; nenhuma política nova é necessária porque a tabela de arquivo não é exposta ao cliente (só `service_role`).
- Nenhuma mudança de comportamento visível no app; os fluxos, o inbox e o CRM continuam iguais.

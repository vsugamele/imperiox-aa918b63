# Rodada 2 de otimização do banco imphq_*

Sim — ainda há oportunidades grandes, e a maior delas é espaço/RAM, não índice novo.

## O que foi medido agora

| Achado | Número real |
|---|---|
| Índice ivfflat **duplicado** em `imphq_wa_knowledge` | `imphq_wa_knowledge_embedding_idx` = 87 MB, **0 usos** |
| `imphq_wa_knowledge` total | 409 MB para apenas **1.166 linhas** (heap 63 MB + toast 91 MB + índice embedding 166 MB) |
| Índices novos criados na rodada 1 | `idx_wa_knowledge_project_source` e `idx_wa_knowledge_source_pattern`: **0 usos** (planner ignora, tabela inchada) |
| Outros índices nunca usados (>200 kB) | ~10 índices em `imphq_events`, `imphq_funnel_events`, `imphq_wa_rule_applications`, `imphq_embedding_cache`, `imphq_wa_conversations` |
| Varreduras completas | `imphq_ig_webhook_logs` 8.969 seq scans / 141 mi linhas lidas; `imphq_wa_conversations` 98.317 seq scans / 36 mi; `imphq_wa_triage` 7.198 seq scans / 13 mi |
| `imphq_leads` por id | 2,7 milhões de chamadas (N+1 nas edge functions) |
| `imphq_automacoes` | 163.582 varreduras da tabela inteira |

O painel enviado (Disk 42%, RAM 64%, Compute picos 100%, swap 367 MB) é consistente com esses ~409 MB numa instância `t4g.micro`.

## O que será feito

### 1. Recuperar ~300 MB (maior ganho)
- Remover o índice ivfflat duplicado `imphq_wa_knowledge_embedding_idx` (87 MB, zero uso).
- `REINDEX` do `idx_wa_knowledge_embedding` (166 MB para 1,1 mil vetores é bloat) e `VACUUM FULL` da tabela + toast.
- Efeito: menos disco, menos pressão de RAM/cache, menos swap.

### 2. Limpar índices mortos
- Remover os índices com 0 usos e tamanho relevante (lista acima), mantendo chaves primárias e únicas.
- Efeito: escrita mais rápida em `imphq_events`/`imphq_funnel_events` (tabelas de log de alto volume) e menos disco.

### 3. Cortar as varreduras completas restantes
- `imphq_wa_conversations`: identificar a consulta do Inbox que varre a tabela e prender ao índice existente `idx_wa_conv_last_message_at`/`idx_wa_conv_project`; remover os 8 índices parciais nunca usados dessa tabela.
- `imphq_wa_triage`: índice usado só 232 vezes contra 7.198 varreduras — ajustar a consulta para filtrar por `projeto_id` + data.
- `imphq_ig_webhook_logs`: identificar quem lê sem filtro (monitor do Zernio) e restringir a janela de tempo + colunas.

### 4. Reduzir chamadas repetidas (N+1)
- Cache do lead por execução nas edge functions que ainda repetem `imphq_leads` por `id`.
- `imphq_automacoes`: filtrar por `ativo`/ids e cachear por rodada de cron em vez de ler a tabela inteira.
- `imphq_wa_knowledge`: nunca trazer `embedding` nem varrer por `source` sem `project_id`.

## Detalhes técnicos
- `DROP INDEX` / `REINDEX` / `VACUUM FULL` rodam fora de migração transacional; `VACUUM FULL` bloqueia a tabela por alguns segundos (1.166 linhas, impacto mínimo).
- Antes de remover cada índice, confirmo `idx_scan = 0` e que não é PK/UNIQUE.
- Sem mudança de comportamento visível: Inbox, CRM, fluxos e RAG continuam iguais.
- Verificação: `pg_total_relation_size` antes/depois, `EXPLAIN (ANALYZE, BUFFERS)` nas consultas de Inbox/triagem e reset de `pg_stat_statements` para medir a rodada limpa.

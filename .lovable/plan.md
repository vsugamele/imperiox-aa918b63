## Problema confirmado
Encontrei **21 grupos duplicados nos últimos 60 dias** inflando **R$ 3.769,37** em receita. Exemplo: mesma venda Hotmart inserida 2x no mesmo segundo (race condition + payload em formatos distintos escapando da dedup atual de 5 min).

## Causa raiz no `webhook-pagamento`
1. Dedup só compara janela de 5 min + lead+produto+valor → eventos duplicados fora da janela passam
2. Sem chave única por transação (`codigo_pedido` / `transaction_id`)
3. Race condition: dois webhooks simultâneos fazem `SELECT` ao mesmo tempo, ambos não encontram, ambos inserem
4. Bumps Ticto sem nenhuma dedup
5. Status `'aprovado'` vs `'aprovada'` tratados como diferentes em alguns lugares

## Correções

### 1. Migration: chave única no banco (defesa final)
- Adicionar coluna `external_transaction_id TEXT` em `imphq_vendas` (codigo_pedido / transaction.hash / order_hash)
- Backfill da coluna a partir do JSONB `data` para vendas existentes
- Índice `UNIQUE (project_id, external_transaction_id) WHERE external_transaction_id IS NOT NULL`
- Isso garante que mesmo com race condition o segundo insert falha

### 2. Limpeza dos duplicados históricos
- Migration que mantém apenas 1 venda por grupo (a com payload mais completo / `data` não vazio), apagando as demais
- Rodar em transação, com log do que foi removido em `imphq_events` pra rastreabilidade

### 3. Refatorar `webhook-pagamento/index.ts`
- Extrair `external_transaction_id` no topo, pra todas plataformas (Hotmart `transaction`, Ticto `order.hash`, Kiwify `order_id`)
- Antes de cada insert de venda aprovada / bump: `SELECT` por `external_transaction_id` no projeto → se existir, faz UPDATE em vez de INSERT
- Tratar erro `23505` (unique_violation) como sucesso silencioso (foi outro processo que ganhou a corrida)
- Aplicar mesma lógica para bumps Ticto

### 4. Normalizar status
- Migration leve: `UPDATE imphq_vendas SET status='aprovado' WHERE status='aprovada'`

## Arquivos afetados
- **Nova migration**: adicionar coluna + backfill + índice único + dedup histórica + normalização de status
- **Editar** `supabase/functions/webhook-pagamento/index.ts`: extração de `external_transaction_id`, dedup forte, tratamento de unique_violation

## Riscos
- Backfill precisa lidar com payloads em formatos heterogêneos (Hotmart, Ticto, Kiwify) — vou mapear os campos por plataforma antes
- Índice UNIQUE pode falhar na criação se houver duplicatas remanescentes → a limpeza histórica precede a criação do índice na mesma migration

## Resultado esperado
- Receita real reduzida em ~R$ 3.769,37 (correção, não perda)
- Zero duplicatas futuras, mesmo sob retries da Hotmart ou race conditions

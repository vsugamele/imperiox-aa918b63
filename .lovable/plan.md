## Objetivo

Hoje toda venda é contabilizada pelo `valor` bruto da transação. Quando o infoproduto é dividido com expert/co-produtor, o número infla o "faturamento" mas mascara o **lucro real seu**. As plataformas já mandam a sua parte — só não estamos usando.

## O que já temos (boa notícia)

O webhook `webhook-pagamento` **já salva** os campos certos em `imphq_vendas.data` (jsonb):

- **Ticto** → `data.comissao_produtor` (sua parte líquida em R$)
- **Hotmart** → `data.valor_liquido` (líquido) + `data.comissao_produtor`
- **Kiwify** → `data.comissao_produtor` + `data.valor_liquido`

O problema: esses valores ficam enterrados no JSONB e nenhum dashboard/relatório usa. Só o `valor` bruto é lido.

## Plano

### 1. Coluna física `valor_liquido` em `imphq_vendas`
Migration que:
- Adiciona `valor_liquido NUMERIC` (nullable).
- Backfill: `UPDATE` puxando `COALESCE((data->>'comissao_produtor')::numeric, (data->>'valor_liquido')::numeric, valor)` em todas as vendas existentes.
- Trigger `BEFORE INSERT/UPDATE` que recalcula `valor_liquido` automaticamente sempre que `data` mudar (mesma lógica do COALESCE). Garante que webhooks novos preenchem sem mexer no edge function.

### 2. Webhook `webhook-pagamento`
Pequeno ajuste: setar `valor_liquido` direto na linha do insert (além de continuar salvando em `data`). Cinto e suspensório.

### 3. Configuração de split por projeto/produto (fallback)
Nem toda plataforma manda comissão (ex: Ticto antigo, vendas manuais). Adicionar em `imphq_projects.settings` (jsonb existente) uma chave:

```json
{
  "revenue_splits": {
    "default_share": 0.5,
    "by_product": { "Nome do Produto": 0.6 }
  }
}
```

Quando a venda **não** tiver `comissao_produtor` nem `valor_liquido`, o trigger aplica `valor * share` usando essa config (lookup via função `public.get_producer_share(project_id, produto_nome)`).

### 4. UI — Toggle "Receita Bruta vs Líquida (sua parte)"

Adicionar toggle global no Dashboard, Finanças e Gerenciador (mesmo padrão do "Comparar período"). Persiste em `localStorage`.

Quando ligado:
- **Dashboard** (`DashboardStats`, `DashboardRevenue`, `DashboardCharts`, `DashboardCards`, `RecoveryGlobalCard`) — soma `valor_liquido` em vez de `valor`.
- **Finanças** (`FinancasOverview`, `FinancasProdutos`, `FinancasPerformance`, projeção mensal) — recalcula receita, lucro (líquido − ads − custos fixos) e ROAS real.
- **Gerenciador / Ads** (`KpiCardsHeader`, `CampanhasTable`, `adsVerdict`) — ROAS e CPA passam a usar líquido (ESCALAR/MATAR baseado no que sobra de verdade pra você).
- **Cohort / LTV** — LTV por canal/criativo em líquido.

### 5. Card "Split de Receita" em Finanças
Novo bloco mostrando lado a lado, por produto, no período:
- Receita bruta
- Sua parte (líquido)
- Repassado a expert / plataforma / taxas
- % da sua fatia

Para o usuário enxergar onde a fatia é menor e priorizar produtos de melhor margem.

### 6. Configuração visual do split
Tela em `/projetos/:id` (aba Finanças/Configurações do projeto) com:
- Input "Sua fatia padrão (%)"
- Lista por produto com fatia customizada
- Mostra % detectada automaticamente das últimas 20 vendas (média de `comissao_produtor / valor`) como sugestão.

## Arquivos a tocar

**Backend**
- `supabase/migrations/...` — coluna + backfill + trigger + função `get_producer_share`
- `supabase/functions/webhook-pagamento/index.ts` — setar `valor_liquido` no insert

**Frontend (helper compartilhado)**
- `src/lib/revenueMode.ts` (novo) — hook `useRevenueMode()` + helper `getRevenue(venda, mode)`
- `src/components/shared/RevenueModeToggle.tsx` (novo)

**Telas que consomem `imphq_vendas.valor`** (substituir por helper):
- `src/components/dashboard/DashboardStats.tsx`, `DashboardRevenue.tsx`, `DashboardCharts.tsx`, `DashboardCards.tsx`, `DashboardAds.tsx`, `RecoveryGlobalCard.tsx`, `PredictiveDashboard.tsx`
- `src/components/financas/FinancasOverview.tsx`, `FinancasProdutos.tsx`, `FinancasPerformance.tsx`, `FinancasAds.tsx`
- `src/components/gerenciador/KpiCardsHeader.tsx`, `CampanhasTable.tsx`, `src/lib/adsVerdict.ts`, `src/pages/Gerenciador.tsx`
- `src/lib/cohortAnalysis.ts`, `src/lib/creativeLtv.ts`

**Novo**
- `src/components/financas/RevenueSplitCard.tsx`
- Aba de configuração de split em `src/pages/ProjetoDetalhe.tsx`

## Memória

Salvar `mem://features/finance/revenue-split` documentando: campos da Ticto/Hotmart/Kiwify, coluna `valor_liquido`, lógica do trigger, fallback via `imphq_projects.settings.revenue_splits`, toggle global.

## Entrega faseada

Se preferir cortar, faço em 2 levas:

1. **Leva 1 (essencial)**: migration + backfill + trigger + helper + toggle + Dashboard + Finanças.
2. **Leva 2 (refino)**: Gerenciador/Ads em líquido, Card de Split, configuração visual por projeto, Cohort/LTV.

Me confirma se quer tudo de uma vez ou só a Leva 1 primeiro.
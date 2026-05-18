# Sprint 3 — Inteligência Persistente & Cross-Project

## P3 — Plano de Ataque com progresso persistente
**Arquivo:** `src/components/projeto/SalesPathButton.tsx` + nova aba no `ProjetoDetalhe`

- Adicionar checkbox em cada item de `acoes_72h` e `acoes_30d` para marcar como **feito / em andamento / descartado**.
- Persistir status em nova coluna `progress` (jsonb) na tabela `imphq_sales_paths` (chave: hash da ação → `{status, done_at, note}`).
- Header do plano mostra barra: `X/Y ações concluídas` + tempo desde criação.
- Botão "Renovar plano" só aparece se >70% concluído OU >14 dias — evita gerar planos novos sem executar o anterior.
- Em `ProjetoComando.tsx`, mostrar mini-card "Plano ativo: X% concluído" linkando pro Sheet.

## P4 — Portfólio Cross-Project (`Projetos.tsx`)
Nova seção colapsável no topo da grid:

- **KPIs agregados:** Receita 30d total, ROAS médio ponderado por spend, # leads 7d, # projetos com Health < 50.
- **Ranking:** top 3 projetos por receita 30d + top 3 por crescimento (delta% vs 30d anterior).
- **Alertas globais:** lista de projetos em estado `cold` ou com gasto sem venda 7d, com CTA "→ Imperius" que cria ação `portfolio_triage` priorizada.
- Reaproveita `loadKpis` já implementado no Sprint 1; agrega no client.

## G2 — Regras Preditivas no Gerenciador
**Arquivos:** `src/components/gerenciador/RulesPanel.tsx`, nova edge `ads-rules-suggester`

- Edge function `ads-rules-suggester` lê últimos 30 dias de `imphq_ads_actions` com `impact_roas_delta` ou `impact_cpa_delta` positivos.
- Agrupa por padrão (ex.: "pausar ad com CTR<0.8% e spend>R$50 → ROAS +X% em 7d").
- Retorna sugestões com confiança (n amostras + delta médio).
- `RulesPanel` ganha aba **"Sugestões da IA"** mostrando regras propostas com botão "Criar regra" (preenche o form com os thresholds inferidos).

## Banco de dados
```sql
ALTER TABLE imphq_sales_paths ADD COLUMN IF NOT EXISTS progress jsonb DEFAULT '{}'::jsonb;
-- imphq_ads_actions já tem impact_roas_delta / impact_cpa_delta do Sprint 1
```

## Edge Functions
- `ads-rules-suggester` (nova) — analisa histórico, retorna `{rules: [{name, conditions, expected_delta, confidence, samples}]}`.

## Ordem de execução
1. Migration `progress` em `imphq_sales_paths`
2. Atualizar `SalesPathButton` com checkboxes + persistência
3. Mini-card "Plano ativo" em `ProjetoComando`
4. Seção Portfólio em `Projetos.tsx`
5. Edge `ads-rules-suggester` + aba "Sugestões da IA" em `RulesPanel`

Confirma seguir nessa ordem?
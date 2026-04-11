

# Plano: Corrigir Filtros de Produto e Projeto em Finanças

## Problemas identificados

1. **Filtro de produto não afeta KPIs corretamente**: Quando seleciona um produto (ex: "Código dos Cortes"), apenas `fVendas` é filtrado. Os ads (`fAds`), custos e KPIs continuam mostrando valores de TODOS os produtos — gerando números inconsistentes (ex: ROAS mistura receita de 1 produto com gasto total de ads).

2. **Filtro "Todos os Projetos" não reflete nos dados**: Os custos globais (`fCustos`) nunca são filtrados por projeto (linha 105: `const fCustos = custos`). Além disso, ao selecionar produto, os ads deveriam ser proporcionalizados ao produto selecionado.

## Correções

### `src/pages/Financas.tsx`

**A) Proporcionalizar Ads quando filtro de produto ativo:**
- Quando `filterProduct !== "all"`, calcular a % de receita daquele produto sobre o total de vendas
- Aplicar essa % ao total de ads para gerar um "ads proporcional" nos KPIs
- Isso faz ROAS, CPA, Lucro e ROI refletirem corretamente o produto selecionado

**B) KPIs contextuais:**
- `totalReceita` já funciona (vendas filtradas + receita manual)
- `adsTotal` → quando produto selecionado: `adsTotal * (receitaProduto / receitaTotal)`
- Lucro, ROI, ROAS recalculados com o ads proporcional

**C) Garantir que custos de projeto filtrem corretamente:**
- Manter custos globais (ferramentas) sempre visíveis (são da empresa inteira)
- Custos de projeto e ads já filtram por `filterProject`

**D) Overview e Performance — propagar filtro de produto:**
- Passar `filterProduct` como prop para `FinancasOverview` e `FinancasPerformance`
- No `dailyData`, quando produto filtrado, usar apenas vendas daquele produto

### `src/components/financas/FinancasOverview.tsx`
- Receber `adsProportional` ao invés de `totalAds` quando produto selecionado
- ROAS Real e CPA Real usarem o valor proporcionalizado

## Resultado esperado
- Selecionar "Código dos Cortes" → KPIs mostram receita só desse produto, ads proporcionais, ROAS correto
- Selecionar "Todos os Projetos" → dados completos de todos os projetos
- Filtros combinam entre si (projeto + produto + data)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/Financas.tsx` | Proporcionalizar ads por produto, corrigir KPIs |
| `src/components/financas/FinancasOverview.tsx` | Usar ads proporcional nos cálculos |


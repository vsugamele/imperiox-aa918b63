

# Plano: Melhorar dados na aba Produtos do Financas

## Problema identificado

Na linha 440 do `Financas.tsx`:
```typescript
<FinancasProdutos vendas={fVendas} />
```

O componente `FinancasProdutos` aceita 5 props (`vendas`, `briefingProdutos`, `revenues`, `costs`, `ads`), mas so recebe `vendas`. Por isso todas as colunas Custos Op., Custos Ads, Imposto mostram "—" e o Lucro Liquido = Receita.

Alem disso, a aba Produtos nao mostra **Gasto Ads Total** nem **ROAS por produto**, que sao os dados que voce precisa pra entender quanto gastou vs quanto retornou por periodo.

## Solucao

### 1. Passar todas as props filtradas para FinancasProdutos

```typescript
<FinancasProdutos
  vendas={fVendas}
  revenues={fProjectRevenues}
  costs={fProjectCosts}
  ads={fAds}
  briefingProdutos={briefingProdutos}
```

Tambem precisa carregar `briefingProdutos` dos projetos (campo `briefing` JSONB que contem `produtos[]`).

### 2. Adicionar KPIs de Ads na aba Produtos

Novos cards nos KPIs do `FinancasProdutos`:
- **Gasto Ads** (total do periodo)
- **ROAS** (receita / ads)
- **CPA** (ads / vendas)

### 3. Adicionar coluna ROAS por produto na tabela

Nova coluna "ROAS" na tabela mostrando `receita / custosAds` por produto — o dado mais importante pra saber se cada produto esta pagando o ads.

### 4. Carregar briefingProdutos dos projetos

No `load()` do `Financas.tsx`, extrair `briefing.produtos` dos projetos carregados para popular tipo, preco e imposto_pct de cada produto.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/Financas.tsx` | Passar `revenues`, `costs`, `ads`, `briefingProdutos` para FinancasProdutos + carregar briefing dos projetos |
| `src/components/financas/FinancasProdutos.tsx` | Adicionar KPIs (Gasto Ads, ROAS, CPA) + coluna ROAS na tabela |


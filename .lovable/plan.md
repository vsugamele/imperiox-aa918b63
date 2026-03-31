

# Plano: Filtro de Período + KPIs Avançados na aba Leads

---

## Problema

A aba "Leads" mostra KPIs (total, clientes, carrinho, pix pendente, VIP, receita) calculados sobre TODOS os leads, sem filtro de período. O filtro de período só existe na aba "Analytics". Faltam métricas importantes como: Pix em aberto, taxa de conversão, carrinho abandonado, aguardando recuperação.

## Solução

### 1. Filtro de período na aba Leads

Adicionar a mesma barra de período (`analyticsPeriod` + botões "Hoje", "7d", "30d", etc.) acima dos KPIs na aba Leads. Reaproveitar o estado `analyticsPeriod` que já existe. Os leads na tabela e KPIs serão filtrados pelo período selecionado.

- Criar `periodFiltered` que aplica o filtro de período antes dos outros filtros
- Os KPIs passam a ser calculados sobre `periodFiltered` em vez de `leads`

### 2. KPIs expandidos (8 cards em vez de 6)

Reorganizar os KPI cards para incluir:

| KPI | Cálculo |
|---|---|
| Total Leads | leads no período |
| Novos Hoje | leads com `criado_em` = hoje |
| Clientes | status = "cliente" no período |
| Carrinho Abandonado | stage = "carrinho_abandonado" no período |
| Pix em Aberto | stage = "pix_gerado" ou "aguardando_pagamento" no período |
| Taxa de Conversão | (clientes / total leads) * 100 no período |
| Aguardando Recuperação | leads com stage pix/carrinho criados há mais de 24h |
| Receita no Período | soma `total_gasto` dos leads no período |

Layout: `grid-cols-2 md:grid-cols-4 lg:grid-cols-8` (compacto). Cada card continua clicável para filtrar.

### 3. Implementação

No `filtered`, adicionar o filtro de período:
```
const periodFiltered = filtered.filter(l => {
  if (!l.criado_em) return false;
  const d = parseISO(l.criado_em);
  return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to });
});
```

A barra de período ficará logo acima dos KPIs, depois dos filtros de busca/plataforma/status/estágio.

---

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/pages/Leads.tsx` | Filtro de período na aba Leads + 8 KPIs com métricas avançadas |


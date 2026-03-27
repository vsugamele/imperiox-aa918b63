

# Plano: CRM Avancado — Produtos por Projeto, Tempo de Conversao, Analytics Melhorado e Filtros por Periodo

## Resumo das melhorias solicitadas

1. Ao clicar em um produto na sidebar, mostrar contagem de leads daquele produto
2. Produtos organizados dentro de cada projeto (colapsavel/expansivel)
3. Tempo de conversao: quanto tempo entre captura e compra
4. Analytics com muito mais profundidade e filtros por periodo
5. Cruzar dados de Ads no Analytics para comparar gastos vs receita

---

### 1. Sidebar: Produtos dentro de Projetos (colapsavel)

Atualmente a sidebar lista projetos e depois uma lista flat de produtos. Melhorar para:

- Cada projeto vira um item colapsavel (chevron para expandir/recolher)
- Ao expandir, mostra os produtos daquele projeto com contagem de leads por produto
- Badge com contagem ao lado de cada produto
- "Todos os leads" e "Sem projeto" ficam no topo

```text
🌐 Todos os leads (342)
📂 Sem projeto (12)
▼ 🚀 JP Freitas (180)
   🏷️ Finalização Express (45)
   🏷️ Mentoria VIP (22)
   🏷️ Curso Completo (113)
▶ 📁 Outro Projeto (150)
```

**Arquivo**: `src/pages/Leads.tsx` — sidebar section (linhas 470-502)

---

### 2. Contagem de leads por produto visivel

Quando o usuario clica em um produto, alem de filtrar, mostrar:
- Badge com total de leads daquele produto no KPI area
- No titulo da tabela: "Produto: Finalizacao Express — 45 leads"

**Arquivo**: `src/pages/Leads.tsx`

---

### 3. Tempo de conversao (Lead → Compra)

Calcular a diferenca entre `criado_em` do lead e `created_at` da primeira venda aprovada. Exibir:

- No detalhe do lead (aba Dados): "⏱️ Tempo até compra: 3 dias 4h"
- No Analytics: grafico com distribuicao de tempo de conversao (0-1d, 1-3d, 3-7d, 7-14d, 14-30d, 30d+)
- Metrica media no KPI do Analytics

Para leads que ainda nao compraram, mostrar "Aguardando conversao — X dias desde captura"

**Arquivo**: `src/pages/Leads.tsx`

---

### 4. Analytics expandido com filtros por periodo

Adicionar barra de filtros no topo do Analytics:
- Seletor de periodo: Hoje, 7 dias, 30 dias, 90 dias, Este mes, Mes passado, Custom (date picker)
- Todos os graficos e KPIs filtrados pelo periodo selecionado

Novos cards/graficos no Analytics:
- **KPIs do periodo**: Total leads, Novos no periodo, Conversoes, Taxa de conversao %, Receita, Ticket medio, Tempo medio de conversao
- **Leads por Produto** (bar chart horizontal com contagem)
- **Receita por Produto** (bar chart)
- **Distribuicao tempo de conversao** (bar chart: 0-1d, 1-3d, etc)
- **Leads vs Ads** (AreaChart cruzando novos leads/dia com gasto ads/dia, usando `imphq_ads_spend`)
- **ROI por periodo**: Receita de vendas vs Gasto em ads do periodo

**Arquivo**: `src/pages/Leads.tsx` — tab Analytics (linhas 654-728)

---

### 5. Cruzar Ads no Analytics

Buscar dados de `imphq_ads_spend` filtrados por periodo e projeto. Mostrar:
- Card "Investido em Ads no periodo" + "ROAS do periodo"
- Grafico timeline Ads vs Receita (mesmo estilo do FinancasOverview)

**Arquivo**: `src/pages/Leads.tsx` — carregar `imphq_ads_spend` no `load()`

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/pages/Leads.tsx` | Sidebar colapsavel por projeto com produtos e contagens, filtro por periodo no Analytics, novos graficos (produtos, tempo conversao, ads vs receita), KPIs do periodo, carregar ads_spend |


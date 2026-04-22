

## Plano: Finalizar reorganização (Comando + KPIs Hero em Ads/Finanças)

Implementar as 3 partes pendentes do plano anterior.

### 1. ProjetoComando — 4 blocos estratégicos

Adicionar acima do conteúdo atual:

- **Pulso de Hoje** (linha hero, 4 mini-cards):
  - Receita hoje vs ontem (delta colorido)
  - Leads hoje vs média 7d
  - Vendas hoje (count)
  - Gasto em ads hoje
- **Top 3 Produtos do mês**: receita • nº vendas • ticket médio. Click abre `ProductInsightDrawer`.
- **Alertas Inteligentes**: reusa `DashboardAlerts` filtrado por `projectId` (PIX pendente, anomalias, CPA piorando).
- **Próximas Ações**: merge de tarefas urgentes do Kanban + eventos calendário próximas 48h.

Layout: grid 2 colunas em telas largas, stack em mobile.

### 2. FinancasAds — KPIs Hero + sub-tabs

Substituir KPIs soltos por 4 **KPI Hero Cards**:
- ROAS Real • CPA Médio • Investido • Lucro Ads
- Cada card: valor grande + delta vs período anterior + semáforo (verde ≥2x ROAS / amarelo 1-2x / vermelho <1x) + tooltip explicando cálculo.

Mover diagnóstico Yoshitani para topo (badges).

Sub-tabs internas: `[Visão] [Campanhas] [Criativos] [Logs]` (reorganizando conteúdo já existente).

### 3. FinancasOverview — Mini-funil + Eficiência por campanha

- **Mini-funil compacto** acima da tabela: Investido → Cliques → Vendas → Receita → Lucro (5 etapas horizontais com setas e %).
- **Card "Eficiência por Campanha"**: tabela top 10 — campanha • gasto • vendas atribuídas (UTM via `imphq_vendas`) • ROAS real, ordenado desc por ROAS.

### 4. ProjetoInsights — KPIs Hero na aba Tráfego

Adicionar 4 cards hero (ROAS, CPA, Hook Rate, Frequência) com semáforo no topo da aba "Tráfego & Ads". Tabela compacta "Top 5 Campanhas" no fim com link "Ver tudo em Finanças → Ads".

### Componente compartilhado

Criar `src/components/shared/KpiHeroCard.tsx`:
- Props: `label`, `value`, `delta?`, `benchmark?: { good, warn }`, `tooltip?`, `format` (currency/number/percent/multiplier).
- Renderiza valor grande, `DeltaBadge` (já existe), bolinha de semáforo, tooltip via HoverCard.

### Arquivos
- **Novo**: `src/components/shared/KpiHeroCard.tsx`
- **Editar**: `src/components/projeto/ProjetoComando.tsx` (4 blocos)
- **Editar**: `src/components/financas/FinancasAds.tsx` (KPIs hero + sub-tabs)
- **Editar**: `src/components/financas/FinancasOverview.tsx` (mini-funil + eficiência)
- **Editar**: `src/components/projeto/ProjetoInsights.tsx` (KPIs hero aba Tráfego)

### Fora de escopo
- Persistir sub-tab ativa em URL.
- Comparativo período-anterior em Insights (só Finanças nesta rodada).


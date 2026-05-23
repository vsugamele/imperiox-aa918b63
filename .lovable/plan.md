## Custo de Captura em /leads

Cruzar leads capturados × gasto em ads para revelar CPL real por período, plataforma e campanha.

### 1. Hook `useLeadCostMetrics.ts`
- Input: período (start/end) + `project_id`.
- Queries paralelas:
  - `imphq_leads` no período → total + agrupado por `utm_source` e `utm_campaign`.
  - `imphq_ads_insights` (ou tabela equivalente já usada em `/financas/ads`) no mesmo período → soma `spend` total, por `platform` e por `campaign_name`.
- Retorna:
  - `totalLeads`, `totalSpend`, `cpl` (spend ÷ leads)
  - `byPlatform`: [{ source, leads, spend, cpl }]
  - `byCampaign`: top 10 por gasto
  - `sparkline`: série diária (leads, spend, cpl) últimos 30d
  - Delta vs período anterior

### 2. KPI mini no header de `/leads`
- Usar slot `kpi` do `PageHeader` já existente.
- Mostrar: `CPL R$ X,XX` + hint `Y leads · R$ Z gasto`.
- Tooltip explicando fórmula.

### 3. Nova tab "💰 Custo" na navegação de `/leads`
Hoje as tabs são Leads / Analytics / Predições — adicionar Custo entre Analytics e Predições.

Conteúdo:
- **Linha de KPIs** (`KpiHeroCard`): Leads · Gasto · CPL · Δ vs período ant.
- **Tabela por plataforma**: Meta / Google / TikTok / Orgânico (via `utm_source`) — leads, gasto, CPL, % do total.
- **Tabela top 10 campanhas** por gasto, com CPL e nº de leads, ordenável.
- **Sparkline 30d** (Recharts) com linhas de leads e CPL.
- Empty state quando não houver dados de ads conectados, com CTA para `/financas` → Ads.

### 4. Reutilização
- `KpiHeroCard`, `PageHeader`, padrão de tabela e Recharts já usados em `/gerenciador`.
- Mesma lógica de período do filtro global de `/leads`.

### Detalhes técnicos
- Fonte de gasto: confirmar tabela usada por `FinancasAds.tsx` (provável `imphq_ads_insights` / `imphq_ads_daily`). Hook deve respeitar `project_id` quando filtrado.
- Leads sem UTM caem em "Orgânico/Direto" (não inflar CPL de plataformas pagas).
- CPL exibido só quando `leads > 0 && spend > 0`; senão "—".
- Sem mudanças de schema; sem novas edge functions.

### Fora de escopo
- Atribuição multi-touch, LTV por canal, mudanças em `/financas` ou `/gerenciador`.



## Plano: Tooltips ricos, Drill-Down por Produto e Limites Adaptativos

### 1. Tooltips aprimorados (Heatmap + Funil)
- Substituir `title=""` nativo por `<HoverCard>` (Radix, já disponível) com conteúdo formatado:
  - **Heatmap horário/dia**: Hora/Dia • Contagem • % do total • R$ acumulado (quando `source=vendas`) • Ticket médio da janela • Ranking (#1/#2/#3 se aplicável).
  - **Funil de Ads (cada etapa)**: Etapa • Valor absoluto • % do passo anterior • Drop-off em vermelho • Custo médio por evento (spend/etapa) quando aplicável.
  - **KPIs Ads (CTR/Hook/Hold/Freq/CPM)**: valor • benchmark de referência • status semáforo explicado.
- Mobile/touch: HoverCard já abre no toque (`openDelay=0` em mobile).

### 2. Drill-Down por Produto (modal/sheet)
- Cards de Insight (linha "Top Produtos" no resumo) ficam clicáveis.
- Ao clicar, abre `<Sheet>` lateral (`ProductInsightDrawer`) com visões filtradas **só daquele produto**:
  - **Resumo**: total de registros, receita, ticket médio, melhor janela.
  - **Picos**: heatmap horário (24h) + ranking top 5 horários com tooltips ricos.
  - **Dias da semana**: barras com R$ por dia.
  - **Demografia**: donut de gênero, faixas etárias, top 10 UFs com barra proporcional.
  - **Funil de Ads do produto**: 6 etapas + diagnóstico automático (Hook fraco / LP lenta / Checkout abandonado).
- Reusa as funções de agregação extraídas para hooks puros (`useAudienceAgg(rows)`, `useAdsAgg(adsRows)`) para evitar duplicação.
- Card "Top Produtos" novo no resumo: lista os 5 produtos com mais registros + receita; cada linha clica e abre o drawer.

### 3. Limites adaptativos (sem cortes)
- Trocar `.limit(8000)` / `.limit(10000)` fixos por **paginação iterativa em chunks de 1000** (limite real do Supabase) usando `range(from, to)` até retornar página parcial:
  - Helper `fetchAll<T>(builder, pageSize=1000, hardCap=50000)` que faz loop até esvaziar.
  - Aplicado nas 3 queries: `imphq_vendas`, `imphq_leads`, `imphq_ads_spend`.
  - `hardCap` de segurança para não travar UI em projetos enormes (50k registros já cobre 1 ano com folga).
- Indicador de carregamento mostra "Carregando X registros…" quando busca >2 páginas.
- Cache leve em memória por `(projectId, period, source, produto)` pra evitar re-fetch ao reabrir drawer.

### Arquivos
- `src/components/projeto/ProjetoInsights.tsx` — refator: extrai agregações, adiciona HoverCards, lista de produtos clicável, troca queries por `fetchAll`.
- **Novo** `src/components/projeto/insights/ProductInsightDrawer.tsx` — Sheet com sub-views por produto (reusa agregações).
- **Novo** `src/components/projeto/insights/aggregations.ts` — funções puras `aggregateAudience()` / `aggregateAds()` / `buildFunnel()` / `buildDiagnostics()`.
- **Novo** `src/lib/supabasePaginate.ts` — helper `fetchAll`.

### Fora de escopo
- Persistir filtro entre sessões.
- Export CSV do drawer (pode ser próximo passo).




## Melhorias em Insights de Audiência

### 1. Filtro de Produto
- Buscar `produto_nome` distintos das vendas do projeto e popular um Select.
- Aplicar filtro nas queries (vendas direto; leads via `ultimo_produto`).
- Layout: Select de produto ao lado dos toggles Vendas/Leads e Período.

### 2. Visual mais polido
- Heatmap de horários: 2 linhas (AM/PM) com tooltip melhor + destaque do top 3 horários (não só pico).
- Dias da semana: barras com gradiente ouro + valor monetário (R$) ao lado da contagem quando source=vendas.
- Gênero: donut chart minimalista no lugar da barra (mais legível) + total absoluto no centro.
- Faixa Etária: agrupar com % e absoluto, esconder ranges zerados, colorir maior bucket.
- Top Estados: mostrar mapa simplificado (lista top 10 com barra horizontal proporcional + bandeira regional emoji).
- Card "Resumo" no topo: total de registros, ticket médio (vendas), melhor janela (dia+hora combinados).

### 3. Nova seção: Insights de Ads (Funil de Tráfego)
Bloco novo no mesmo componente, abaixo da audiência, usando `imphq_ads_spend` filtrado por projeto + período + produto (campanha contém nome do produto):

**Funil visual horizontal**: Impressões → Cliques no Link → Visitas LP → Add to Cart → Checkout Iniciado → Compras
- Cada etapa: número absoluto + % do passo anterior + drop-off em vermelho se >70%.
- Diagnóstico automático de gargalo:
  - **Hook fraco**: hook_rate < 25% → "Criativo não prende atenção nos primeiros 3s"
  - **Lentidão LP**: cliques > 0 mas LP views < 70% dos cliques → "⚠️ Possível lentidão na LP — perdendo X% no carregamento"
  - **LP não converte**: LP views ok mas checkout < 5% → "Copy/oferta da LP não convence"
  - **Checkout abandonado**: init_checkout > compras × 3 → "Checkout com fricção"
- KPIs auxiliares: CTR médio, CPM, Hook Rate, Hold Rate, Frequência (com semáforo verde/amarelo/vermelho).

**Card "Lentidão Detectada"**: razão `link_clicks / landing_page_views`. Se >1.4 (mais de 40% dos cliques nunca chegam à LP), exibe alerta destacado em vermelho com a métrica e sugestão de auditar velocidade da LP.

### 4. Performance
- Queries em paralelo (`Promise.all`).
- Limit aumentado para 10k apenas quando necessário; manter 5k default.

### Arquivos
- `src/components/projeto/ProjetoInsights.tsx`: refator visual + filtro de produto + nova seção AdsInsights inline (ou subcomponente).

### Fora de escopo
- Mapa SVG real do Brasil (lista com barra basta).
- Persistir filtros (estado local).


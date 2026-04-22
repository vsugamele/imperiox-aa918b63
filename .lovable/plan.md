

## Plano: Reorganizar Insights para experiência unificada e clara

Reordenar e agrupar as seções do `ProjetoInsights.tsx` numa hierarquia narrativa "do macro ao micro", com âncoras visuais e navegação por abas pra reduzir scroll infinito.

### Nova arquitetura visual (top → bottom)

```text
┌─────────────────────────────────────────────────────────┐
│ 1. BARRA DE FILTROS (sticky)                            │
│    Período • Fonte (Vendas/Leads) • Produto             │
├─────────────────────────────────────────────────────────┤
│ 2. RESUMO EXECUTIVO (4 KPIs grandes lado a lado)        │
│    Registros • Receita • Ticket Médio • Melhor Janela   │
├─────────────────────────────────────────────────────────┤
│ 3. TABS NAVEGÁVEIS                                      │
│    [👥 Audiência] [📈 Tráfego & Ads] [📦 Produtos]      │
└─────────────────────────────────────────────────────────┘
```

### Tab 1 — Audiência (quando, quem, onde)
Grid 2 colunas em telas largas:
- **Coluna esquerda (Quando)**: Heatmap horário AM/PM + Dias da semana empilhados.
- **Coluna direita (Quem & Onde)**: Donut de gênero + faixa etária + Top 10 UFs.

### Tab 2 — Tráfego & Ads (diagnóstico)
- Card de **Diagnóstico Automático** no topo (badges coloridos: Hook fraco / LP lenta / Checkout abandonado).
- **Funil horizontal** de 6 etapas com tooltips ricos.
- Grid de **5 KPIs com semáforo** (CTR, CPM, Hook, Hold, Frequência).
- Alerta vermelho destacado se "Lentidão LP" detectada.

### Tab 3 — Produtos (drill-down)
- Lista "Top Produtos" expandida (ranking completo, não só top 5).
- Cada linha: produto • registros • receita • ticket • % do total + barra proporcional.
- Click abre `ProductInsightDrawer` (já existente).

### Melhorias de clareza
- **Filtros sticky** no topo durante scroll (não perde contexto ao navegar).
- **KPIs do resumo executivo** com setas de comparação (vs período anterior) quando houver dados.
- **Empty states** explícitos ("Sem dados de ads neste período — verifique sincronização").
- **Loading skeleton** unificado em vez de "Carregando…" cru.
- **Espaçamento consistente** (`space-y-8` entre blocos, `gap-6` dentro de grids).
- **Títulos de seção** com ícone + descrição curta (1 linha) explicando o que é mostrado.

### Arquivos
- `src/components/projeto/ProjetoInsights.tsx` — refator estrutural (Tabs do shadcn, ordem, sticky bar, skeletons). Lógica de agregação intacta (já está em `aggregations.ts`).

### Fora de escopo
- Comparação período-anterior (precisa lógica nova — pode ser próximo passo).
- Persistir tab ativa em URL.


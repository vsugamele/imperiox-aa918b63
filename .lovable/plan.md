# Redesign Dashboard — Híbrido

Aplicando só em `/dashboard` (Dashboard.tsx + componentes filhos visuais). Sem mexer em lógica de dados, queries ou rotas. Os 4 mockups não vieram com os .jsx, então a direção "Híbrido" é inferida pelos nomes: **Editorial (tipografia serifada protagonista) + Comando (densidade cockpit, faixas KPI fixas) + Imperius Nativo (IA como camada superior, não card lateral)**.

## Direção visual

- **Hero editorial fixo no topo**: faixa fina com timestamp ao vivo, projeto/produto ativo em cápsulas, "Briefing do Dia" reduzido a 1 frase + CTA. Cormorant em itálico para a frase, DM Sans uppercase tracking-widest para metadata. Substitui o atual `<PageHeader>` + `<DailyBriefing>` colapsado.
- **Faixa KPI tipo cockpit (sticky)**: 6 métricas (Receita, Vendas, Leads, CAC, ROAS, PIX em risco) em linha única, separadores verticais hairline gold/15, números em Cormorant 3xl, delta em mono. Substitui o grid atual do `DashboardStats`. Mobile vira scroll horizontal snap.
- **Imperius nativo (não mais card no header)**: faixa horizontal logo abaixo dos KPIs com as 3 próximas ações da fila + badge AUTO. Promove `NextActionCard` + `ActionInbox` para o corpo. Clique abre o feed completo em sheet lateral.
- **Grid editorial 12 col**: substitui o atual `grid-cols-1 lg:grid-cols-3` por um layout assimétrico:
  - Coluna larga (8): Receita + gráfico (DashboardRevenue)
  - Coluna estreita (4): empilhado Funil de Aquisição + Recuperação Global
  - Faixa full-width: Ads + Hot Leads lado a lado (6/6)
  - Faixa full-width: Charts + Cards (editorial cards, sem bordas, divisores hairline)
- **Tokens**:
  - Divisor `editorial-divider` (já existe no index.css) usado entre seções no lugar de borders de Card.
  - Cards principais: `bg-transparent` + borda só no hover (mantém densidade visual sem peso).
  - Cor de fundo da página continua `--background` (#080607); secundárias `bg-secondary/30`.
- **Tipografia**: títulos de seção em Cormorant itálico 2xl com kicker DM Sans uppercase em gold (`text-gold tracking-editorial text-[10px]`).
- **Filtros**: barra de filtros vira sticky discreta abaixo do hero, pill-shaped, com chips removíveis (em vez dos Selects de altura 8 atuais).
- **Microinterações**: fade-in escalonado por seção (já tem `animate-fade-in`), hover gold sutil em cards-âncora (`card-hover-gold`).

## Arquivos tocados

- `src/pages/Dashboard.tsx` — re-layout, remove uso de `PageHeader`, introduz seções com kicker editorial.
- `src/components/dashboard/DashboardStats.tsx` — refator visual da grid pra faixa cockpit horizontal (lógica intacta).
- `src/components/dashboard/DailyBriefing.tsx` — modo compacto (1 frase) usado no hero.
- `src/components/dashboard/NextActionCard.tsx` — variante "inline strip" usada na faixa Imperius.
- (Novo) `src/components/dashboard/DashboardHero.tsx` — hero editorial.
- (Novo) `src/components/dashboard/ImperiusStrip.tsx` — strip horizontal de próximas ações.
- `src/index.css` — adicionar utilitários `.kicker`, `.editorial-section-title`, `.kpi-strip-divider` (sem alterar tokens HSL).

## Fora de escopo

- Sidebar e header globais (AppLayout) ficam como estão.
- /imperius, /leads, /whatsapp não mudam.
- Nenhuma query, RLS, edge function ou tabela alterada.
- Sem novas dependências.

## Validação

- Build automático do harness.
- Conferir visualmente o /dashboard no viewport atual (1817px) + mobile via responsive.
- Smoke check: KPIs continuam batendo (números iguais ao layout atual).

```text
┌─────────────────────────────────────────────────────────────┐
│  KICKER · OVERVIEW                       2024-05-24 · 14:32 │
│  "Hoje começa com R$ 12k em PIX quentes."   [Ver Recuperação]│
├─────────────────────────────────────────────────────────────┤
│ RECEITA │ VENDAS │ LEADS │ CAC │ ROAS │ PIX RISCO          │
├─────────────────────────────────────────────────────────────┤
│ IMPERIUS · 3 ações pendentes  → [▸ ação 1] [▸ 2] [▸ 3] AUTO │
├──────────────────────────────────────┬──────────────────────┤
│  Receita (gráfico grande)            │  Funil Aquisição     │
│                                      │  ─────                │
│                                      │  Recuperação Global  │
├──────────────────────────────────────┴──────────────────────┤
│  Ads Performance         │  Hot Leads                        │
├─────────────────────────────────────────────────────────────┤
│  Charts editoriais (sem cards, divisores hairline)          │
└─────────────────────────────────────────────────────────────┘
```

Se aprovar, implemento na próxima mensagem em build mode.
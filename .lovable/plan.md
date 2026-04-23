

## Diagnóstico: Drill-down do Dashboard

Sim, criamos. A funcionalidade existe mas **não está visível em todos os cards** — só nos componentes que importam o `DashboardDrillSheet`. Vou auditar e padronizar.

### Estado atual (já implementado)
- `src/components/dashboard/DashboardDrillSheet.tsx` existe (painel lateral genérico).
- Cards de Receita e Ads têm cliques funcionais → abrem detalhes.
- Memory `features/dashboard/interactive-drill-down` confirma: cards do Dashboard Principal e Ads são interativos.

### O que está faltando (hipótese a confirmar lendo os arquivos)
1. **`DashboardStats`** (KPIs do topo: Receita, Leads, Vendas, Ticket Médio) — provavelmente sem clique.
2. **`ConversionFunnel`** — etapas do funil deveriam abrir lista de leads daquela etapa.
3. **`DashboardCards`** (Top Produtos, Top Canais) — linhas deveriam drill-down pra produto/canal.
4. **`DashboardCharts`** — pontos do gráfico sem clique pra ver dia específico.
5. **Pista visual**: cards clicáveis precisam de `cursor-pointer` + hover sutil + ícone de expandir, senão o usuário não descobre.

---

### Plano de execução

**Etapa 1 — Auditoria rápida (sem código)**
Ler `DashboardStats.tsx`, `ConversionFunnel.tsx`, `DashboardCards.tsx`, `DashboardCharts.tsx`, `DashboardDrillSheet.tsx` pra confirmar exatamente o que tem e o que falta. Reporto em 1 mensagem curta.

**Etapa 2 — Padronizar interatividade**
- Adicionar `onClick` + `cursor-pointer` + ícone `Maximize2` em todos os KPI cards do `DashboardStats`.
- Cada clique abre `DashboardDrillSheet` com o dataset correspondente (ex: clicar em "Receita" → lista de vendas do período; clicar em "Leads" → lista de leads).
- `ConversionFunnel`: cada etapa vira clicável → painel com leads daquela etapa.
- `DashboardCards` (top produtos/canais): linhas clicáveis → painel com vendas/leads daquele item.
- `DashboardCharts`: tooltip com botão "Ver detalhes do dia X".

**Etapa 3 — Pista visual global**
- Hover state consistente: `hover:border-primary/40 transition-colors`.
- Ícone `Maximize2` no canto superior direito de cada card clicável.
- Tooltip "Clique para detalhar" no primeiro acesso (opcional).

---

### Fora de escopo
- Drill-down no `PredictiveDashboard` e `GrowthDashboard` (ficam pra Sprint 5 se quiser).
- Exportar CSV do drill (também Sprint 5).

Aprova que eu começo pela Etapa 1 (auditoria) e já emendo a Etapa 2 na sequência.


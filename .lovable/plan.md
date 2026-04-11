

# Plano: Refatorar Dashboard e Leads em Componentes Menores + Paginação

## Situação Atual

- **Dashboard.tsx**: 941 linhas — 1 único componente com ~25 states, queries sequenciais (algumas já em Promise.all), e toda a UI inline
- **Leads.tsx**: 2029 linhas — 1 único componente com ~40 states, lógica de CRUD, timeline, analytics, filtros, WhatsApp, tudo misturado

## Estratégia

Extrair seções lógicas em componentes filhos, movendo state e queries relacionados. O componente pai fica como orquestrador leve (filtros globais + layout).

---

## 1. Dashboard — Dividir em ~6 componentes

**Manter em `Dashboard.tsx`** (~150 linhas):
- States globais: `dashPeriod`, `dashProject`, `allProjects`, `isAdmin`
- Render: filtros + grid de componentes filhos

**Novos componentes em `src/components/dashboard/`:**

| Componente | Responsabilidade | States migrados |
|---|---|---|
| `DashboardStats.tsx` | 4 KPI cards (Projetos, Tarefas, Leads, Custo) | `stats` |
| `DashboardRevenue.tsx` | Receita Total + Automações + WhatsApp + Hot Leads | `totalReceita`, `receitaBreakdown`, `autoExecCount`, `waStats`, `hotLeads` |
| `DashboardAds.tsx` | Ads KPIs + Top Campanhas + Ads por Projeto | `adsGlobal` |
| `DashboardCharts.tsx` | Leads Trend, Receita vs Custo, Funil, ROAS, Pie charts | `leadsTrend`, `receitaVsCusto`, `funnelData`, `roasData`, `receitaPorProjeto`, `receitaPorProduto` |
| `DashboardCards.tsx` | Projetos Recentes, Atenção Necessária, Eventos, Oportunidades, Saúde Financeira, Cards Kanban | `recentProjects`, `urgentTasks`, `upcomingEvents`, `opportunities`, `projectFinance`, `recentCards` |

Cada componente recebe props: `period`, `projectFilter`, `isAdmin` e faz suas próprias queries internamente via `useEffect`.

## 2. Leads — Dividir em ~5 componentes

**Manter em `Leads.tsx`** (~200 linhas):
- States globais: filtros, page, leads[], projects[]
- Função `load()` principal
- Render: tabs + filtros + componentes filhos

**Novos componentes em `src/components/leads/`:**

| Componente | Responsabilidade | States migrados |
|---|---|---|
| `LeadsTable.tsx` | Tabela de leads + seleção + paginação | `selectedIds`, render da tabela |
| `LeadDetailDialog.tsx` | Dialog de edição + timeline + score + formulários + vendas | `editLead`, `timeline`, `timelineLoading`, `scoreLog`, `formResponses`, `leadAutomationLogs` + `loadTimeline()` |
| `LeadsAnalytics.tsx` | Tab "Analytics" inteira (KPIs, gráficos, funil, conversão) | `analyticsPeriod`, `periodLeads`, `periodVendas`, `periodAds`, `periodKPIs`, todos os `useMemo` de analytics |
| `LeadsSidebar.tsx` | Sidebar lateral com projetos/produtos agrupados + leads por mês | `projectProductMap`, `expandedProjects`, `leadsByMonth` |
| `LeadWhatsAppDialog.tsx` | Dialog de envio rápido de WhatsApp | `showWaDialog`, `waTarget`, `waProviderId`, `waMessage`, `waSending` |

## 3. Otimizações de Query

- **Leads.tsx**: `allVendasRaw` carrega TODAS as vendas sem filtro de projeto — adicionar filtro `project_id` quando `projectFilter !== "all"`
- **Dashboard.tsx**: Queries de funnel (`totalLeads`, `pixLeads`, `buyers`) são feitas sequencialmente após o primeiro Promise.all — mover para dentro do mesmo batch
- Vendas em Leads: limitar a 1000 registros mais recentes (atualmente sem limit)

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/Dashboard.tsx` | Reduzir para ~150 linhas (orquestrador) |
| `src/components/dashboard/DashboardStats.tsx` | Novo — KPI cards |
| `src/components/dashboard/DashboardRevenue.tsx` | Novo — Receita + WA + Hot Leads |
| `src/components/dashboard/DashboardAds.tsx` | Novo — Ads performance |
| `src/components/dashboard/DashboardCharts.tsx` | Novo — Gráficos principais |
| `src/components/dashboard/DashboardCards.tsx` | Novo — Listas e cards informativos |
| `src/pages/Leads.tsx` | Reduzir para ~200 linhas (orquestrador) |
| `src/components/leads/LeadsTable.tsx` | Novo — Tabela paginada |
| `src/components/leads/LeadDetailDialog.tsx` | Novo — Painel de detalhe do lead |
| `src/components/leads/LeadsAnalytics.tsx` | Novo — Analytics completo |
| `src/components/leads/LeadsSidebar.tsx` | Novo — Sidebar projetos/produtos |
| `src/components/leads/LeadWhatsAppDialog.tsx` | Novo — Dialog WA rápido |

## Resultado

- Dashboard: 941 → ~150 linhas (pai) + 5 componentes de ~150 linhas cada
- Leads: 2029 → ~200 linhas (pai) + 5 componentes de ~300 linhas cada
- Melhor manutenção, carregamento mais rápido (queries paralelas), e code splitting natural


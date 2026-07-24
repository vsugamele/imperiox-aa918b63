
## Ideia
Hoje `/tarefas` é só uma central de tarefas/kanban/rotinas, e o dashboard editorial vive em `/dashboard` (rota escondida). O foco diário do operador precisa acontecer no mesmo lugar onde ele já entra pra bater tarefa — então a Central de Tarefas vira o **Cockpit da Empresa**: o pulso de vendas + a fila de decisões + as tarefas do dia, tudo numa tela.

## O que muda

### 1. Nova página `/tarefas` — Cockpit + Foco
Topo (Cockpit da empresa — recolhível):
- `EditorialHeader` (receita hoje/MTD/projeção/ROAS/margem)
- `ProjectSellingGrid` (projetos vendendo) + `DecisionQueue` (fila Imperius) lado a lado
- `BlendedFunnelStrip` (funil 30d)
- `OperationsFooter` (IA, conversas, tarefas vencidas, recuperação)

Meio (Foco do dia — sempre visível):
- Faixa "Hoje" com 3 blocos densos:
  - **Tarefas para hoje** (vencidas + vence hoje, top 8, com quick-complete)
  - **Ações Imperius pendentes** (ActionInbox compacto)
  - **Hot leads (2h)** já vindo do `useProjectPulse` global

Base (Central de Tarefas — mantém o que existe):
- As abas atuais (Rotinas / Tarefas / Kanban / Calendário / Processos / Chat) continuam idênticas, dentro de um accordion "Gestão completa" que abre logo abaixo do foco do dia.

### 2. Sidebar & rotas
- `AppSidebar`: item "Tarefas" vira **"Cockpit"** (ícone `LayoutDashboard`), ainda apontando pra `/tarefas`.
- `/` (index) passa a redirecionar pra `/tarefas` em vez de `/imperius`.
- `/dashboard` continua funcionando (para quem tem link salvo) mas some da sidebar; a versão clássica segue em `/dashboard-classic`.

### 3. Preferência de densidade
- Toggle no header do cockpit: **Compacto** (só foco do dia + tarefas) ↔ **Completo** (cockpit inteiro). Persistido em `localStorage` (`cockpit.density`).
- Default: Completo no desktop, Compacto no mobile.

## Fora do escopo
- Nenhuma mudança em lógica de negócio (finanças, Imperius, tarefas). Só reorganização de tela.
- Não mexemos em `/dashboard-classic`, `/imperius`, nem no schema.

## Detalhes técnicos
- Editar `src/pages/Tarefas.tsx`: envolver o conteúdo atual num `<Collapsible>` "Gestão completa"; adicionar acima o bloco Cockpit (importando os 4 componentes de `components/dashboard/cockpit/*`) e a faixa "Foco do dia".
- Criar `src/components/dashboard/cockpit/TodayFocusStrip.tsx` com 3 colunas (tarefas de hoje via `imphq_tasks`, `ActionInbox` compacto, hot leads via `useProjectPulse` agregado).
- Editar `src/components/AppSidebar.tsx`: renomear label "Tarefas" → "Cockpit", trocar ícone.
- Editar `src/App.tsx`: `<Route index>` aponta para `/tarefas`.
- Adicionar toggle de densidade (Shadcn `ToggleGroup`) no header da página.

## Entregável
Ao entrar na plataforma, o operador cai direto no Cockpit: vê receita/ROAS/fila de decisão, o que precisa fazer hoje, e tem a central de tarefas completa a um clique de distância — sem trocar de página.



# Plano: Completar Aba Processos + Gráficos Dashboard

Continuação da implementação anterior. Faltam 2 partes.

---

## 1. TabsContent "Processos" em Tarefas

O estado, CRUD e TabsTrigger já existem (linhas 146-154, 340-397, 774-777). Falta o `TabsContent value="processes"` com a UI.

**Implementação** (inserir após o fim do TabsContent "calendar", antes dos Dialogs):

- Barra de filtros: filtro por membro (`processFilterMember`) e categoria (`processFilterCategory`)
- Botão "Novo Processo"
- Lista de processos filtrados, cada um com:
  - Card com título, categoria badge, membro responsável
  - Steps como checklist (com toggle `toggleProcessStep`)
  - Botões editar/excluir
- Dialog de criar/editar processo (`showProcessDialog`) com:
  - Título, descrição (textarea), categoria (select), membro, projeto
  - Lista de steps editável: input + botão adicionar, reordenar, remover
  - Botão salvar chamando `saveProcess()`

**Arquivo**: `src/pages/Tarefas.tsx` — ~150 linhas inseridas

---

## 2. Gráficos extras no Dashboard

**Melhorias em `src/pages/Dashboard.tsx`**:

- **Gráfico Receita por Projeto** (barras horizontais): agrupar `imphq_vendas` + `imphq_project_revenue` por `project_id`, exibir top 5
- **Gráfico Receita por Produto** (pizza/donut): agrupar `imphq_vendas.produto`
- **Gráfico ROAS por mês**: `receita / custo` para cada mês dos dados já carregados em `receitaVsCusto`
- Imports: `PieChart, Pie, Legend` do recharts
- Layout: nova row de 3 colunas abaixo dos gráficos existentes

**Arquivo**: `src/pages/Dashboard.tsx`

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/Tarefas.tsx` | TabsContent "processes" com UI completa + Dialog de processo |
| `src/pages/Dashboard.tsx` | 3 gráficos novos (receita por projeto, por produto, ROAS) |


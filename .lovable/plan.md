

# Plano: Kanban com Scope/Projeto, Fix Criar Tarefa, Templates no OpenFlow

## 3 problemas identificados

---

### 1. Kanban -- falta seletor de scope (agente/humana/geral) e projeto no dialog de novo card + analytics

**Problema**: O dialog "Novo Card" no Kanban (`KanbanPage.tsx` linhas 835-890) tem campos de título, descrição, prioridade, data, responsável e quadro (board), mas NÃO tem seletor de **projeto**. O campo "Quadro" já permite escolher entre agentes/humanas/criativos/campanhas, mas só aparece quando `activeBoard === "geral"`.

**Solução**:
- Adicionar estado `newProjectId` no KanbanPage (já existe `projects` carregado)
- Adicionar Select de Projeto no dialog de novo card (sempre visível)
- Incluir `project_id` no `createCard()`
- Adicionar mini-analytics no topo do Kanban: cards por board, por prioridade, atrasados, concluídos (4 KPI cards compactos acima das tabs)

**Arquivo**: `src/pages/KanbanPage.tsx`

---

### 2. Tarefas -- botão "Criar tarefa" / "Adicionar" não funciona

**Problema**: O `addQuickTask()` (linha 374) encontra a primeira coluna de qualquer board e insere. O problema é que usa um loop `for (const board of boards)` que pega o primeiro board disponível, mas pode falhar se não encontrar a coluna ou se `boards` está vazio. Além disso, o botão "Adicionar" (linha 783) chama `addQuickTask` mas não há um botão separado "Criar tarefa" com dialog -- o usuário provavelmente quer um dialog mais completo como no Kanban.

**Solução**:
- Adicionar um botão "Criar Tarefa" que abre um dialog completo (como no Kanban) com: título, descrição, prioridade, projeto, responsável, board, data
- Corrigir `addQuickTask` para usar o board filtrado ou "agentes" como fallback robusto
- O dialog usa `columns` para encontrar a coluna correta do board selecionado

**Arquivo**: `src/pages/Tarefas.tsx`

---

### 3. OpenFlow -- puxar templates dos projetos na automação

**Problema**: Ao editar uma automação no FlowEditor, o campo "Mensagem / Template" é um textarea livre. Não puxa templates já criados dentro dos projetos (emails, copy arsenal, etc).

**Solução**:
- No `OpenFlow.tsx`, quando o editing dialog abre e tem `project_id`, buscar dados do projeto (`data` JSONB) que contém templates de email, copy arsenal, etc.
- No FlowEditor, adicionar um botão "📋 Usar Template" ao lado do textarea que abre um dropdown/select com templates disponíveis do projeto
- Templates viriam de: `imphq_projects.data.emails[]`, `imphq_projects.data.copy_arsenal`, ou da tabela de automações do próprio projeto
- Ao selecionar, preenche o textarea com o conteúdo do template

**Arquivos**: `src/pages/OpenFlow.tsx`, `src/components/openflow/FlowEditor.tsx`

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/KanbanPage.tsx` | Adicionar seletor de projeto no dialog de novo card, mini-analytics no topo |
| `src/pages/Tarefas.tsx` | Dialog completo "Criar Tarefa" com todos os campos, fix addQuickTask |
| `src/pages/OpenFlow.tsx` | Buscar templates do projeto ao editar automação, passar para FlowEditor |
| `src/components/openflow/FlowEditor.tsx` | Botão "Usar Template" no textarea de cada ação, receber templates via props |


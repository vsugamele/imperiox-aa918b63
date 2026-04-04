

# Plano: Expert no Kanban + Subtarefas com Responsavel + Secao Experts + Dashboard Interativa

---

## 4 Melhorias Solicitadas

### 1. Expert e Produto nos cards do Kanban
Hoje o card mostra projeto (badge) mas nao mostra o expert do projeto nem o produto. O expert esta no `project.data.expert.nome` e o produto em `project.data.briefing.produto`.

**Solucao**:
- No `KanbanPage.tsx`, ao carregar projetos, buscar tambem `data` do projeto (ja vem como JSONB)
- No `renderCard`, se o card tem `project_id`, exibir badge do expert (nome + mini avatar) e badge do produto
- No `CardDetailPanel`, mostrar expert e produto como campos somente-leitura quando o card esta vinculado a um projeto

### 2. Subtarefas (checklist) com responsavel
A tabela `imphq_card_checklists` nao tem coluna `member_id`. Subtarefas sao anonimas — ninguem sabe quem e responsavel por cada item.

**Solucao**:
- **Migracao SQL**: `ALTER TABLE imphq_card_checklists ADD COLUMN member_id UUID REFERENCES imphq_team_members(id);`
- No `CardDetailPanel`, ao criar subtarefa, poder selecionar um responsavel (Select de membros ao lado do input)
- Exibir avatar do responsavel ao lado da subtarefa
- Essa subtarefa aparecera no "Meu Dia" do membro e na secao de experts/responsaveis

### 3. Secao "Experts" — visao por expert/responsavel
Criar uma nova aba no Kanban ou uma secao filtravel que agrupa cards por expert do projeto. Assim o usuario ve rapidamente o que esta pendente para cada expert (ex: "Jonathan precisa gravar webinar").

**Solucao**:
- Adicionar aba "Experts" ao BOARDS do Kanban (ou como filtro visual)
- Agrupar cards por expert do projeto vinculado: buscar `project.data.expert.nome` para cada card com `project_id`
- Mostrar tambem subtarefas atribuidas a membros que sao experts
- Layout: colunas por expert, cada coluna mostra cards + subtarefas pendentes

### 4. Dashboard — Tarefas urgentes interativas com responsaveis
Hoje a secao "Tarefas Urgentes" mostra titulo + projeto + prioridade, mas nao mostra o responsavel nem permite acao rapida.

**Solucao no `Dashboard.tsx`**:
- Na query de urgentTasks, fazer join com `imphq_team_members` para trazer `member_id`
- Exibir avatar do responsavel no card da tarefa
- Adicionar cards travados (status "travado") na mesma secao ou em secao separada "Travados"
- Tornar clicavel: ao clicar, navegar para `/kanban` com filtro aplicado (ou abrir o card detail)
- Mostrar badge "Travado" vs "Urgente" vs "Atrasado" com cores distintas

---

## Detalhes Tecnicos

### Migracao SQL
```sql
ALTER TABLE imphq_card_checklists
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES imphq_team_members(id);
```

### Dados de Expert nos Cards
O `loadAllData` do Kanban ja carrega projetos com `select("id, name")`. Mudar para `select("id, name, data, icon")` para ter acesso ao expert e produto sem query extra.

### Secao Experts no Kanban
Nova aba "experts" que agrupa por `expert.nome` extraido do projeto vinculado. Cards sem projeto ou sem expert ficam em grupo "Sem Expert".

### Dashboard interativa
- Combinar urgentes + travados + atrasados em uma unica secao "Atencao Necessaria"
- Cada item mostra: titulo, badge de status (urgente/travado/atrasado), avatar do responsavel, projeto
- Clicar navega para `/kanban` ou abre um mini-panel

---

## Resumo de Arquivos

| Arquivo | Mudanca |
|---|---|
| **Migracao SQL** | `member_id` em `imphq_card_checklists` |
| `src/pages/KanbanPage.tsx` | Carregar `data` dos projetos, exibir expert/produto nos cards, nova aba "Experts" agrupada |
| `src/components/kanban/CardDetailPanel.tsx` | Subtarefa com seletor de responsavel, exibir expert/produto do projeto |
| `src/pages/Dashboard.tsx` | Secao "Atencao" com urgentes+travados+atrasados, avatar do responsavel, clicavel |

---

## Ordem de Execucao

1. Migracao SQL (member_id na checklist)
2. KanbanPage: carregar dados do expert/produto, exibir nos cards
3. CardDetailPanel: responsavel nas subtarefas
4. KanbanPage: aba "Experts" agrupada
5. Dashboard: secao interativa com responsaveis


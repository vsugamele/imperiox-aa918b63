

# Plano: Sincronizar Tarefas do Kanban com o Calendario

## Objetivo

Quando uma tarefa (card do Kanban) for criada com data de entrega (`due_date`), automaticamente registrar um evento no calendario (`imphq_calendar_events`) com tipo "task". O calendario ganha um novo tipo de evento com visual discreto para nao poluir.

## Mudancas

### 1. Novo tipo de evento "task" no Calendario

Adicionar `{ value: "task", label: "Tarefa", icon: "✅", color: "bg-violet-500/20 text-violet-400" }` na lista `EVENT_TYPES` do `ProjetoCalendario.tsx`. Tarefas aparecem com visual sutil e podem ser filtradas/ocultadas pelo badge de filtro ja existente.

### 2. Funcao auxiliar para criar evento de tarefa

Criar uma funcao utilitaria `createCalendarEventForCard` que:
- Recebe `{ title, due_date, project_id, user_id, card_id }`
- Insere em `imphq_calendar_events` com `event_type: "task"`, `all_day: true`, `description: "Tarefa do Kanban"`
- Usa o `card_id` no campo `description` para referencia (ex: `"[kanban:card_id] Tarefa do Kanban"`)
- Nao bloqueia o fluxo principal (fire-and-forget com `.then()`)

### 3. Integrar nos pontos de criacao de cards

Nos 3 locais que criam cards com `due_date`:

- **KanbanPage.tsx** linha 352 — apos `createCard`, se `newDueDate` existe, chamar a funcao
- **KanbanPage.tsx** linhas 894/914 — criacao inline, mesma logica
- **Tarefas.tsx** linha 1502 — proximo passo, se tiver `due_date`

### 4. Atualizar/remover evento quando card muda

- Quando um card tem seu `due_date` atualizado (no `CardDetailPanel`), atualizar o evento correspondente
- Quando um card e deletado, remover o evento do calendario

### 5. Visual discreto no calendario

Os eventos de tarefa aparecem com icone ✅ e cor violeta suave. No calendario, os dots de tarefa usam a mesma cor dos outros eventos (sem criar poluicao visual adicional). O filtro por tipo permite ocultar tarefas se desejado.

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/ProjetoCalendario.tsx` | Novo EVENT_TYPE "task" |
| `src/pages/KanbanPage.tsx` | Criar evento ao criar card com due_date |
| `src/pages/Tarefas.tsx` | Criar evento ao criar proximo passo com due_date |
| `src/components/kanban/CardDetailPanel.tsx` | Sync evento ao atualizar/deletar card |

## Ordem

1. Adicionar tipo "task" no calendario
2. Implementar logica de criacao de evento nos pontos de insert de cards
3. Sync ao editar/deletar cards


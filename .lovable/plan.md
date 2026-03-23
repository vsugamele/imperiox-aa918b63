

# Plano: Sistema de Tarefas e Kanban Profissional

## Diagnóstico

O sistema atual tem boa base (drag-and-drop, boards, prioridades, responsáveis), mas falta profundidade nos cards — não há como anotar, criar checklists, comentar ou ver histórico. O dialog de edição é básico demais para uso real de time.

## Alterações

### 1. Novas tabelas (migration)

**`imphq_card_checklists`** — subtarefas dentro de cada card:
- `id`, `card_id` (FK), `title`, `is_done`, `position`, `created_at`

**`imphq_card_comments`** — notas/comentários no card:
- `id`, `card_id` (FK), `author_name`, `content`, `created_at`

RLS: acesso autenticado para ambas.

### 2. Substituir dialog de edição por painel detalhado (Sheet)

Novo componente `CardDetailPanel.tsx` — abre como Sheet lateral ao clicar num card, com:

- **Header**: título editável inline, badge de prioridade, botão fechar
- **Seção Info**: responsável (select), data limite (datepicker), projeto, board, coluna (select para mover)
- **Descrição**: textarea editável com auto-save
- **Checklist**: lista de subtarefas com checkbox, adicionar nova, reordenar, barra de progresso (ex: "3/5 concluídas")
- **Comentários**: timeline de notas com campo de texto para adicionar, mostra autor + data
- **Ações**: botão excluir card

Usado tanto no KanbanPage quanto no Tarefas (Meu Dia).

### 3. Melhorar Kanban com filtro de projeto

Adicionar Select de projeto no header do KanbanPage, filtrando cards por `project_id`. Também mostrar badge do projeto nos cards quando visível.

### 4. Melhorar "Meu Dia" com edição inline

Ao clicar numa tarefa no Meu Dia, abre o mesmo `CardDetailPanel`, permitindo anotar e gerenciar checklists sem sair da tela.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_card_checklists` e `imphq_card_comments` com RLS |
| `src/components/kanban/CardDetailPanel.tsx` | **Novo** — painel detalhado do card |
| `src/pages/KanbanPage.tsx` | Trocar dialog de edição por CardDetailPanel + filtro projeto |
| `src/pages/Tarefas.tsx` | Integrar CardDetailPanel ao clicar numa tarefa |

## Fluxo

```text
Card no Kanban / Meu Dia
        │ click
        ▼
┌─ CardDetailPanel (Sheet) ──────────┐
│  📝 Título editável                │
│  👤 Responsável  📅 Prazo  📁 Proj │
│  📋 Descrição                      │
│  ☑️ Checklist (subtarefas)         │
│  💬 Comentários / Anotações        │
│  🗑️ Excluir                       │
└────────────────────────────────────┘
```


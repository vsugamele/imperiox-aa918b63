

# Plano: 4 Melhorias — Instagram, Anexos no Projeto, Kanban no Dashboard, Pastas de Projetos

---

## 1. Instagram — campo de usuário nos Links & Redes Sociais

**Problema**: No Briefing, o campo Instagram só aceita URL. Mas no Instagram o `@usuario` é mais útil (para pesquisa, concorrentes, etc).

**Solução**: No array `SOCIAL_NETWORKS` do `ProjetoBriefing.tsx`, quando a rede for `instagram`, exibir um campo extra de `@usuario` além da URL. Salvar como `instagram_handle` no `data.social_links`.

**Arquivo**: `src/components/projeto/ProjetoBriefing.tsx`

---

## 2. Anexos de tarefas visíveis dentro do projeto

**Problema**: Fotos anexadas a cards do Kanban (via `CardDetailPanel`) ficam apenas no card. Não aparecem na aba Mídia do projeto.

**Solução**: Na aba Mídia (`ProjetoMidia.tsx`), adicionar uma seção "Anexos de Tarefas" que busca `imphq_card_attachments` dos cards vinculados ao projeto (`project_id`). Exibir como galeria read-only com link para abrir o card.

**Arquivo**: `src/components/projeto/ProjetoMidia.tsx`

---

## 3. Últimas movimentações do Kanban no Dashboard

**Problema**: O `ActivityFeed` só mostra ações registradas em `imphq_activity_log`. Movimentações de cards (criar, mover, completar) não aparecem.

**Solução**: No Dashboard, adicionar uma seção "Últimos Cards" que busca os últimos 10 cards atualizados (`imphq_kanban_cards` ordenados por `updated_at` desc). Exibir título, coluna atual, projeto e tempo relativo. Também registrar `card_created` e `card_moved` no activity feed quando ações acontecerem no Kanban.

**Arquivos**: `src/pages/Dashboard.tsx` (seção "Últimos Cards"), `src/pages/KanbanPage.tsx` (registrar no activity_log ao mover/criar)

---

## 4. Pastas para agrupar projetos

**Problema**: A lista de projetos é flat — todos no mesmo nível, sem agrupamento visual.

**Solução**: Adicionar campo `folder` (string) no projeto. Na página Projetos:
- Barra de pastas no topo (chips clicáveis) com as pastas existentes + "Todos"
- Botão "Nova Pasta" que cria uma pasta (salva como tag no projeto)
- Agrupar cards por pasta visualmente com headers
- Projetos sem pasta aparecem em "Sem pasta"
- No dialog de criação de projeto, campo opcional "Pasta"

**Arquivo**: `src/pages/Projetos.tsx` — filtro por pasta, agrupamento visual, campo pasta no form

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Campo `@usuario` para Instagram nos social links |
| `src/components/projeto/ProjetoMidia.tsx` | Seção "Anexos de Tarefas" buscando attachments por project_id |
| `src/pages/Dashboard.tsx` | Seção "Últimos Cards" com cards recentemente atualizados |
| `src/pages/KanbanPage.tsx` | Registrar card_created/card_moved no activity_log |
| `src/components/dashboard/ActivityFeed.tsx` | Adicionar ícones/labels para card_created e card_moved |
| `src/pages/Projetos.tsx` | Sistema de pastas: filtro, agrupamento, campo no form de criação |


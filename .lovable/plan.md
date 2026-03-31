

# Plano: 5 Melhorias no Kanban/Tarefas

---

## 1. Trocar Board dentro da tarefa (CardDetailPanel)

**Problema**: No `CardDetailPanel.tsx`, o board é exibido apenas como badge estático (linha 396). Não existe Select para mudar o board do card.

**Solução**: Adicionar um Select de "Board" no grid de metadados (ao lado da Coluna). Ao trocar o board:
- Atualizar `card.board` no banco
- Buscar a primeira coluna do novo board e mover o card para lá
- Atualizar `boardColumns` para refletir as colunas do novo board
- Adicionar estado local `boardName` e handler `handleBoardChange`
- Usar `BOARDS = ["geral", "agentes", "humanas", "criativos", "campanhas"]` (mesmo array do KanbanPage)

**Arquivo**: `src/components/kanban/CardDetailPanel.tsx`

---

## 2. Contagem de itens por board no Kanban

**Problema**: Na `TabsList` do KanbanPage (linha ~80), os boards não mostram quantos cards cada um tem.

**Solução**: No `TabsTrigger` de cada board, adicionar Badge com count:
- `allCards.filter(c => c.board === board).length` para boards específicos
- `allCards.length` para "geral"

**Arquivo**: `src/pages/KanbanPage.tsx`

---

## 3. Mais dados no Kanban (mini-analytics)

**Solução**: Adicionar uma barra de stats acima do board com:
- Total de cards no board
- Distribuição por coluna (backlog X, fazendo Y, feito Z)
- Cards atrasados (due_date < hoje e não feito)
- Cards sem responsável
- Layout: row de badges/chips compactos

**Arquivo**: `src/pages/KanbanPage.tsx`

---

## 4. Ocultar concluídas

**Problema**: Cards na coluna "feito" sempre aparecem, poluindo a visão.

**Solução**: Adicionar toggle/switch "Ocultar concluídas" nos filtros do KanbanPage. Quando ativo:
- Na visualização Board: esconder cards da coluna "feito" (ou colapsar a coluna com apenas o count)
- Na visualização Lista: filtrar cards de colunas "feito"
- Estado: `hideDone` boolean, persistido em localStorage

**Arquivo**: `src/pages/KanbanPage.tsx`

---

## 5. Botão IA para gerar documentação das atividades

**Problema**: Não há forma rápida de pedir à IA para resumir/documentar as tarefas do board para o time.

**Solução**: Botão "📄 Gerar Doc com IA" na barra de ações do KanbanPage. Ao clicar:
- Coleta todos os cards do board ativo (título, descrição, responsável, status, prazo)
- Chama a edge function `openflow-ai` com prompt: "Gere um documento resumido das atividades do time para compartilhar. Organize por status e responsável."
- Exibe o resultado em um Dialog com textarea (copiável) e botão copiar
- Usa o modelo já configurado no `openflow-ai`

**Arquivo**: `src/pages/KanbanPage.tsx`

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/kanban/CardDetailPanel.tsx` | Select de Board + handler para mudar board e coluna |
| `src/pages/KanbanPage.tsx` | Count por board, stats bar, toggle ocultar concluídas, botão IA doc |


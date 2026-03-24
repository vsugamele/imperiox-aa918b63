

# Plano: Reorganizar Kanban e Tarefas (inspirado no ClickUp)

## Problema principal

A aba "Geral" agrupa colunas por titulo, mas como cada board cria colunas com nomes ligeiramente diferentes (ex: "A Fazer" vs "Backlog", "Em Progresso" vs "Fazendo"), aparecem dezenas de colunas vazias repetidas. Falta tambem gestao de colunas (renomear, excluir) e uma view de lista como o ClickUp.

## O que sera feito

### 1. Gestao de colunas (renomear, excluir, reordenar)

- Botao de "..." em cada header de coluna com opcoes: Renomear, Excluir (move cards para backlog), Alterar cor
- Dialog simples para renomear coluna inline
- Ao excluir coluna vazia, deletar direto; se tiver cards, perguntar para mover para outra coluna
- Botao "+ Coluna" no final para adicionar novas colunas ao board ativo

### 2. Corrigir "Geral" - normalizar merge de colunas

- Criar mapa de sinonimos para merge inteligente: `{"a fazer": "backlog", "to do": "backlog", "em progresso": "fazendo", "doing": "fazendo", "concluído": "feito", "concluido": "feito", "done": "feito"}`
- Na aba "Geral", usar esse mapa para agrupar colunas com nomes equivalentes numa unica coluna visual
- Reduzir drasticamente o numero de colunas exibidas

### 3. Toggle Board/Lista no Kanban

Adicionar botao de alternancia entre:
- **Board** (view atual de colunas)
- **Lista** (inspirado no ClickUp): tabela agrupada por status/coluna, mostrando Nome, Prioridade, Responsavel, Projeto, Prazo, Board em colunas. Cada grupo e colapsavel com contador

### 4. Painel de filtros avancados

Inspirado no ClickUp (imagem 50):
- Botao "Filtros" que abre um popover/dropdown
- Filtros combinaveis: Status (coluna), Prioridade, Responsavel, Projeto, Prazo (atrasado/hoje/sem prazo)
- Badge mostrando quantidade de filtros ativos
- Botao "Limpar filtros"

### 5. Melhorias nos cards do Kanban

- Ao passar o mouse, mostrar botoes rapidos: editar, mover para feito (check), excluir
- Tags visiveis no card (se houver)

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/pages/KanbanPage.tsx` | Gestao de colunas, merge inteligente no Geral, toggle board/lista, filtros avancados, acoes rapidas nos cards |


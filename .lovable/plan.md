

# Plano: Subtarefas com Responsavel + Dashboard Interativa

Continuacao das 2 tarefas restantes do plano aprovado.

---

## 1. Subtarefas com Responsavel (CardDetailPanel.tsx)

A coluna `member_id` ja existe na tabela. Falta a UI.

**Mudancas na secao Checklist (linhas 697-721)**:
- Ao lado de cada subtarefa, exibir avatar do responsavel (se houver `member_id`)
- Adicionar um mini-select de membro ao lado do checkbox (icone de User clicavel que abre Popover com lista de membros)
- No `addCheckItem`, adicionar campo `newCheckMember` para enviar `member_id` no insert
- No item renderizado, mostrar avatar pequeno (h-5 w-5) clicavel para trocar responsavel

**Fluxo**:
- Cada subtarefa mostra: checkbox + titulo + avatar do responsavel + botao delete
- Clicar no avatar abre select para trocar membro
- Novo input de subtarefa tem seletor de membro ao lado

---

## 2. Dashboard — Secao "Atencao Necessaria" (Dashboard.tsx)

Substituir a secao "Tarefas Urgentes" (linhas 690-718) por uma versao interativa que inclui kanban cards urgentes, travados e atrasados.

**Mudancas**:
- Na query `load()`, buscar kanban cards com status urgente/travado/atrasado em vez de `imphq_tasks`:
  - Cards com `priority = 'urgent'` ou `priority = 'high'`
  - Cards em colunas com titulo contendo "travado"/"bloqueado"
  - Cards com `due_date` vencido
- Fazer join com `imphq_team_members` via `member_id` para trazer nome e avatar
- Fazer join com `imphq_projects` via `project_id` para trazer nome do projeto

**UI da secao**:
- Titulo: "Atencao Necessaria" com icone AlertTriangle
- Cada item mostra:
  - Avatar do responsavel (ou icone User se sem dono)
  - Titulo do card
  - Badge do projeto
  - Badge de status: "Urgente" (vermelho), "Travado" (roxo), "Atrasado" (laranja)
  - Data de vencimento se houver
- Clicavel: `navigate("/kanban")` ao clicar

---

## Arquivos Alterados

| Arquivo | Mudanca |
|---|---|
| `src/components/kanban/CardDetailPanel.tsx` | Seletor de responsavel nas subtarefas, avatar ao lado de cada item |
| `src/pages/Dashboard.tsx` | Secao "Atencao Necessaria" com cards kanban urgentes/travados/atrasados + avatar responsavel + clicavel |

---

## Ordem

1. CardDetailPanel: responsavel nas subtarefas
2. Dashboard: secao interativa


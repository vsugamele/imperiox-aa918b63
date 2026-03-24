

# Plano: Task Detail estilo ClickUp com Custom Fields, Tarefas Relacionadas e Layout 2-colunas

## Situacao atual

O CardDetailPanel e um Sheet lateral simples com campos fixos (responsavel, prazo, prioridade, coluna, projeto), descricao, anexos, checklist e comentarios. Falta:
- Custom Fields (campos personalizados tipo texto, numero, select)
- Tarefas relacionadas/correlacionadas
- Layout mais organizado tipo ClickUp (metadados em grid compacto, activity/comments na lateral)
- Tags editaveis
- Estimativa de tempo
- Data de inicio (alem do prazo)

## O que sera feito

### 1. Migration: tabela `imphq_card_relations`

Para vincular tarefas correlacionadas:
```sql
CREATE TABLE imphq_card_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES imphq_kanban_cards(id) ON DELETE CASCADE,
  related_card_id UUID REFERENCES imphq_kanban_cards(id) ON DELETE CASCADE,
  relation_type TEXT DEFAULT 'related', -- related, blocks, blocked_by
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(card_id, related_card_id)
);
```

### 2. Custom Fields via JSONB `metadata`

O campo `metadata` (JSONB) ja existe na tabela `imphq_kanban_cards`. Usar para armazenar campos personalizados:
```json
{
  "custom_fields": {
    "contato": "Joao Silva",
    "valor_deal": "5000",
    "email": "joao@email.com"
  },
  "start_date": "2026-03-20",
  "time_estimate": "4h"
}
```

Sem necessidade de migration extra -- o campo ja existe.

### 3. Redesign do CardDetailPanel

Inspirado no ClickUp (imagens 53-54), reorganizar o painel:

**Header**: Titulo editavel grande + badge de status/board

**Secao de Metadados** (grid compacto estilo ClickUp):
- Status (coluna) | Responsavel
- Datas: Inicio → Prazo
- Prioridade | Projeto
- Estimativa de tempo | Tags editaveis

**Secao "Fields" (Custom Fields)**:
- Lista de campos chave-valor editaveis inline
- Botao "+" para adicionar novo field (nome + tipo: texto, numero, select)
- Campos salvos no `metadata.custom_fields`
- Cada campo tem botao de excluir ao hover

**Descricao** (textarea expandivel)

**Tarefas Relacionadas**:
- Lista de cards vinculados com badge de tipo (relacionado, bloqueia, bloqueado por)
- Botao "+" que abre um select/search dos cards existentes
- Click no card relacionado abre o detalhe dele

**Anexos** (galeria com lightbox -- ja existe)

**Checklist** (ja existe)

**Anotacoes/Activity** (ja existe)

### 4. Tags editaveis

Atualmente `tags` e um array de strings no card mas nao ha UI para editar. Adicionar:
- Exibir tags como badges editaveis
- Input para adicionar nova tag
- Click no X da tag para remover
- Auto-save no array `tags`

### 5. Melhorias no card mini (KanbanPage)

Mostrar tags nos cards do board quando existirem (badges pequenos coloridos).

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar `imphq_card_relations` |
| `src/components/kanban/CardDetailPanel.tsx` | Redesign completo: layout ClickUp, custom fields, tags, relacoes, datas inicio/prazo, estimativa |
| `src/pages/KanbanPage.tsx` | Mostrar tags nos cards mini |


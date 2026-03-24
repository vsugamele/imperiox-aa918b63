

# Plano: Anexos nas Tarefas + Correção de Duplicatas + Projeto nos Cards

## Problemas identificados

1. **Duplicatas no Kanban "Geral"**: A view "geral" mostra todos os cards agrupados por titulo de coluna. Se existem cards duplicados no banco ou se o merge de colunas cria repetição visual, precisamos deduplicar por `card.id`.

2. **Sem anexos visuais**: O CardDetailPanel tem checklist e comentários mas não permite subir imagens/videos de referência.

3. **Sem indicação de projeto**: Os cards não mostram de qual projeto são, dificultando a visão geral.

## O que será feito

### 1. Migration: tabela `imphq_card_attachments`

Nova tabela para armazenar anexos (imagens, videos, PDFs) vinculados a cards:
```sql
CREATE TABLE imphq_card_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES imphq_kanban_cards(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT, -- image/png, video/mp4, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);
```
Usa o bucket `project-docs` existente para uploads.

### 2. Seção "Anexos" no CardDetailPanel

Adicionar entre a descrição e o checklist:
- Galeria de thumbnails das imagens/videos anexados
- Botão de upload (usando o componente FileUpload existente)
- Click para abrir lightbox (imagem grande) ou player (video)
- Botão de excluir em cada anexo
- Inspirado no ClickUp: seção "Attachments" com preview visual

### 3. Mostrar projeto nos cards

- Carregar projetos (`imphq_projects`) no KanbanPage e Tarefas
- Exibir o nome do projeto como Badge no card (similar ao badge do board)
- No CardDetailPanel, adicionar campo "Projeto" (Select) para vincular/alterar
- Na Tarefas, já mostra o projeto -- manter e reforçar visualmente

### 4. Corrigir duplicatas no Kanban "Geral"

- Na função `filteredCards`, adicionar deduplicação por `card.id` usando `Map` ou `Set`
- Garantir que cada card aparece apenas uma vez mesmo quando múltiplas colunas têm o mesmo título

### 5. Melhorias inspiradas no ClickUp

- **Campo Projeto no detail panel**: Select com projetos disponíveis (como os custom fields do ClickUp)
- **Ícone de anexo no card mini**: Mostrar ícone de clipe quando o card tem anexos
- **Contador de subtarefas no card mini**: Mostrar "2/5" quando tem checklist

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_card_attachments` + RLS |
| `src/components/kanban/CardDetailPanel.tsx` | Seção de anexos com upload/lightbox, campo Projeto |
| `src/pages/KanbanPage.tsx` | Carregar projetos, mostrar projeto no card, fix duplicatas, ícones de anexo/checklist |
| `src/pages/Tarefas.tsx` | Carregar projetos para exibir nos cards |


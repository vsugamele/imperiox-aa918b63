

# Plano: Knowledge Base Dinamica + Fix Drag-and-Drop na Lista

## 2 frentes

### 1. Knowledge Base — secoes dinamicas, subsecoes e documentos vinculados

As colunas `parent_key`, `is_custom`, `doc_ids` ja existem na tabela `imphq_kb` (migration anterior).

**Mudancas no `Docs.tsx`**:

- Carregar secoes do banco (`imphq_kb` com `is_custom = true`) e mesclar com `KB_SECTIONS` como fallback
- Sidebar hierarquica: secoes template + secoes customizadas; subsecoes (entries com `parent_key`) indentadas abaixo do pai
- Botao "Nova Secao" no sidebar com dialog (titulo, emoji/icone, descricao)
- Menu "..." em cada secao com opcoes: "Criar Subsecao", "Renomear" (so custom), "Excluir" (so custom)
- Secoes template sao imutaveis mas aceitam subsecoes
- No editor, secao "Documentos Vinculados" abaixo do textarea: lista docs linkados (do `doc_ids`), botao para adicionar/remover (busca na `imphq_docs`)
- Contadores atualizados no sidebar (total de secoes template + custom)

**Manter `kbTemplates.ts` intacto** como fonte de templates padrao.

### 2. Fix drag-and-drop na view de lista do Kanban

O problema atual: o `onDragOver` e `onDrop` estao no `CollapsibleTrigger` div (header do grupo), mas quando o usuario arrasta sobre as linhas da tabela dentro do grupo, o drop nao funciona porque a area da tabela nao tem handlers.

**Fix no `KanbanPage.tsx`**:

- Adicionar `onDragOver` e `onDrop` no wrapper do `CollapsibleContent` (nao so no header), para que arrastar sobre qualquer parte do grupo funcione
- Adicionar visual feedback: highlight no grupo quando um card esta sendo arrastado sobre ele (ex: borda azul ou bg highlight)
- Garantir que o `DragEvent` type casting esta correto (`React.DragEvent<HTMLDivElement>` em vez de `DragEvent`)
- Adicionar `onDragEnd` para limpar o `dragCardId` caso o drop nao ocorra

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/pages/Docs.tsx` | Reescrever: sidebar hierarquica, CRUD de secoes/subsecoes, vincular docs |
| `src/pages/KanbanPage.tsx` | Fix drag-and-drop: handlers no CollapsibleContent, visual feedback, type fixes |


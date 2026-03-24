

# Plano: Melhorias no Kanban Lista, Tracker e Knowledge Base

## 4 frentes de trabalho

---

### 1. Lista do Kanban — edição inline sem abrir o detalhe

Atualmente a view de lista abre o painel de detalhe ao clicar na linha. Melhorias:

- Colunas Prioridade, Responsavel, Projeto e Prazo se tornam **clicaveis com Select/Popover inline** direto na tabela (sem abrir o CardDetailPanel)
- Prioridade: clicar no badge abre um Select inline com as 4 opcoes
- Responsavel: clicar abre Select com membros
- Projeto: clicar abre Select com projetos
- Prazo: clicar abre Input date inline
- O titulo continua abrindo o detalhe completo
- Cada mudanca faz `supabase.update()` imediato

### 2. Lista do Kanban — drag-and-drop funcional + criar tarefa inline

**Drag-and-drop**: As linhas da tabela precisam de `draggable` e os grupos (CollapsibleTrigger) precisam de `onDragOver`/`onDrop` para mover o card para aquela coluna. Implementar o mesmo pattern do board view.

**Criar tarefa inline**: Adicionar um botao "+" no header de cada grupo colapsavel que mostra um Input inline (titulo + Enter) para criar card rapido naquela coluna, sem abrir dialog.

### 3. Tracker — data/hora inicio e fim com calculo de duracao

Adicionar no formulario de criacao de link e na tabela:
- Campos `data_inicio` (datetime-local) e `data_fim` (datetime-local) no form
- Coluna "Duracao" calculada automaticamente (`data_fim - data_inicio`) exibida em formato legivel (ex: "3d 4h", "2h 30m")
- Persistir via migration: `ALTER TABLE imphq_tracking_links ADD COLUMN data_inicio TIMESTAMPTZ, ADD COLUMN data_fim TIMESTAMPTZ`
- Badge visual mostrando se a campanha esta ativa (dentro do periodo), encerrada ou agendada

### 4. Knowledge Base — secoes dinamicas, subsecoes e documentos vinculados

Atualmente as secoes sao hardcoded em `kbTemplates.ts`. Mudar para:

**Migration**: Adicionar colunas a `imphq_kb`:
```sql
ALTER TABLE imphq_kb ADD COLUMN IF NOT EXISTS parent_key TEXT;
ALTER TABLE imphq_kb ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
ALTER TABLE imphq_kb ADD COLUMN IF NOT EXISTS doc_ids TEXT[];
```
- `parent_key`: para subsecoes (aponta para o `section_key` pai)
- `is_custom`: true = criada pelo usuario (nao template)
- `doc_ids`: array de IDs de documentos vinculados (da tabela `imphq_content_library` ou URLs)

**UI no Docs.tsx**:
- Botao "Nova Secao" no sidebar — dialog pedindo titulo, icone (emoji picker), descricao
- Subsecoes: ao clicar no "..." de uma secao, opcao "Criar Subsecao" — aparece indentada na sidebar
- Secoes customizadas podem ser renomeadas, reordenadas e excluidas
- Secoes template (hardcoded) nao podem ser excluidas mas podem ter subsecoes
- Secao "Documentos Vinculados" no editor: listar docs linkados com botao para adicionar/remover

**Sidebar hierarquica**: Secoes pai mostram subsecoes indentadas abaixo, colapsaveis.

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| Migration SQL | Colunas no tracker (`data_inicio`, `data_fim`) + colunas no KB (`parent_key`, `is_custom`, `doc_ids`) |
| `src/pages/KanbanPage.tsx` | Edicao inline na lista (Select/Popover por coluna), drag-and-drop na lista, criar tarefa inline no grupo |
| `src/pages/Tracker.tsx` | Campos data/hora inicio/fim, calculo de duracao, badge de status temporal |
| `src/pages/Docs.tsx` | Secoes dinamicas, subsecoes, sidebar hierarquica, vincular documentos, CRUD de secoes |
| `src/data/kbTemplates.ts` | Manter como fallback/templates padrao, mas Docs.tsx passa a ler do banco primeiro |




# Plano: 5 Melhorias — Processos com Horário/Fotos, IA com Skills/Mentes, Bug Coluna Duplicada, Próximo Passo em Tarefas, Funis sem Projetos

---

## 1. Processos — Horário e fotos/links de referência

**Problema**: O formulário de processos (`imphq_processes`) só tem título, descrição, steps (checklist), categoria, membro e projeto. Não tem campo de horário nem suporte a fotos/links de referência.

**Solução**:
- Adicionar ao `processForm` os campos `horario` (string, ex: "09:00") e `referencias` (array de `{ tipo: "imagem" | "link", url: string, label?: string }`)
- No dialog de criar/editar processo:
  - Input type="time" para horário
  - Seção "Referências": input de URL + botão adicionar, FileUpload para subir imagem (bucket `project-media`, path `processos/`), lista de referências com preview (thumbnail para imagens, link clicável para URLs), botão remover
- No card do processo na lista, mostrar horário como badge e thumbnails das referências
- Os dados ficam no JSONB `steps` existente — não precisa de migration, pois `horario` e `referencias` podem ser salvos como campos extras no payload do processo (a tabela já aceita JSONB)

**Arquivo**: `src/pages/Tarefas.tsx` (formulário de processo + card)

---

## 2. AIGenerateButton — Buscar Skills e Mentes relevantes + mais modelos

**Problema**: O `AIGenerateButton` envia a ação para `openflow-ai` sem consultar skills nem mentes. Também falta modelos Claude e Kimi.

**Solução em 2 partes**:

**a) Mais modelos no AIGenerateButton**: Adicionar ao array `MODELS`:
- `anthropic/claude-sonnet-4` — "Claude Sonnet"
- `moonshotai/kimi-k2` — "Kimi K2"

**b) Edge function `openflow-ai`**: Antes de chamar a IA, buscar automaticamente:
- Skills relevantes: `SELECT nome, system_prompt FROM imphq_skills WHERE status = 'Ativa' AND system_prompt IS NOT NULL LIMIT 5`
- Mentes: dados de `mentesData.ts` (hardcoded no edge function como referência rápida dos 8 perfis)
- Injetar no system prompt: "Você tem acesso às seguintes skills especializadas: [lista]. Use as mais relevantes para esta tarefa."
- O contexto das skills mais relevantes (por nome/categoria match com a action) será incluído no prompt

**Arquivos**: `src/components/projeto/AIGenerateButton.tsx` (novos modelos), `supabase/functions/openflow-ai/index.ts` (buscar skills + injetar contexto)

---

## 3. Bug — Dropdown de Coluna com duplicatas

**Problema**: Na imagem, o dropdown de "Coluna" no CardDetailPanel mostra "A Fazer" repetido ~6 vezes. O filtro `boardColumns = columns.filter(c => c.board === card.board)` funciona, mas o banco tem múltiplas colunas com o mesmo título no mesmo board (provavelmente criadas acidentalmente).

**Solução**: No `CardDetailPanel.tsx`, deduplicar `boardColumns` por título — manter apenas a primeira coluna de cada título único no board. Isso resolve o visual sem precisar limpar o banco.

```
const boardColumns = columns
  .filter(c => c.board === card.board)
  .filter((c, i, arr) => arr.findIndex(x => x.title === c.title) === i);
```

**Arquivo**: `src/components/kanban/CardDetailPanel.tsx` (linha 359)

---

## 4. Tarefas — "Próximo passo" ao concluir

**Problema**: Quando Bruno marca uma tarefa como concluída, ele quer atribuir um próximo passo a outra pessoa, e ter histórico disso.

**Solução**:
- Ao clicar em "concluir" (checkbox no `toggleDone`), se a tarefa está sendo marcada como feita, abrir um **Dialog de "Próximo Passo"** (opcional):
  - Select de membro responsável
  - Input de título do próximo passo
  - Textarea de observação
  - Botão "Criar próximo passo" → cria novo card no mesmo board/coluna inicial, com `member_id` do selecionado e referência ao card original via `imphq_card_relations` (tipo "sequencia")
  - Botão "Apenas concluir" → fecha sem criar
- Histórico: o `imphq_card_relations` com `relation_type = "sequencia"` já permite rastrear a cadeia. No `CardDetailPanel`, na seção de "Tarefas relacionadas", mostrar relações do tipo "sequencia" com label "Passo anterior" / "Próximo passo"
- Notificação automática para o membro atribuído

**Arquivo**: `src/pages/Tarefas.tsx` (dialog de próximo passo no `toggleDone`), `src/components/kanban/CardDetailPanel.tsx` (label "sequencia" nas relações)

---

## 5. Funis — Projetos e produtos não carregando no editor

**Problema**: A query `select("id, name, briefing")` na linha 115 do `Funis.tsx` não inclui `data`, mas o `useEffect` na linha 129 tenta acessar `proj.data` para extrair produtos. Resultado: `proj.data` é `undefined`, e `projectProductsFull` fica vazio.

**Solução**: Alterar a query para incluir `data`:
```
supabase.from("imphq_projects").select("id, name, briefing, data").order("name")
```

Isso resolve tanto o seletor de projeto (que já funciona com `id, name`) quanto os produtos (que precisam de `briefing` e `data`).

**Arquivo**: `src/pages/Funis.tsx` (linha 115)

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/Tarefas.tsx` | Processos com horário/referências + Dialog "Próximo Passo" ao concluir |
| `src/components/projeto/AIGenerateButton.tsx` | Modelos Claude e Kimi |
| `supabase/functions/openflow-ai/index.ts` | Buscar skills relevantes e injetar no contexto |
| `src/components/kanban/CardDetailPanel.tsx` | Deduplicar colunas no dropdown + label "sequencia" |
| `src/pages/Funis.tsx` | Adicionar `data` na query de projetos |


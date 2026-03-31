

# Plano: Upload de Skills com System Prompt + Seletor de Projeto no Editor de Funis

---

## 1. Upload de Skills (.md / .zip) com System Prompt

**Problema**: A tabela `imphq_skills` não tem coluna `system_prompt` (nem `versao`, `gatilho`, `cor`). O formulário de criação de skill só salva nome, descrição, categoria, status e ícone — sem campo para o conteúdo markdown (system prompt). Skills do ZIP não podem ser instaladas.

**Solução em 2 partes**:

**a) Migration**: Adicionar colunas `system_prompt TEXT`, `versao TEXT`, `gatilho TEXT`, `cor TEXT` na tabela `imphq_skills`.

**b) UI em Skills.tsx**:
- No formulário de criar/editar skill, adicionar:
  - Campo `versao` (Input)
  - Campo `gatilho` (Input — "o que o usuário fornece")
  - Campo `cor` (Input color)
  - Campo `system_prompt` (Textarea grande)
  - **Botão "Importar .md / .zip"** que aceita arquivo `.md` (texto direto) ou `.zip` (extrai o primeiro `.md` encontrado via JSZip). Ao importar, preenche `system_prompt` com o conteúdo e sugere nome baseado no filename
- No `saveSkill()`, incluir os novos campos no insert/update
- No `useEffect` de load, ler `system_prompt, versao, gatilho, cor` do banco
- Skills customizadas com `system_prompt` vão aparecer no "Raio-X" igual às default

**Dependência**: instalar `jszip` para extrair .zip no browser.

**Arquivos**: migration SQL, `src/pages/Skills.tsx`, `src/integrations/supabase/types.ts`

---

## 2. Seletor de Projeto no topo do Editor de Funis

**Problema**: Dentro do editor de funil (canvas), o projeto está fixo ao que foi definido na criação. Não há como trocar ou definir o projeto no topo do editor.

**Solução**: Na barra superior do editor (linha ~428), adicionar um `Select` de projeto logo após o nome do funil. Ao trocar o projeto:
- Atualizar `selectedFunil.project_id` no estado e no banco
- Recarregar produtos/ofertas/links automaticamente (já acontece via useEffect existente)
- Mostrar botão "Dados do Projeto" automaticamente quando houver projeto

**Arquivo**: `src/pages/Funis.tsx`

---

## 3. Produtos e ofertas dentro dos elementos do funil

**Problema**: O painel lateral "Dados do Projeto" já existe, mas ao editar uma etapa individual, não há referência aos produtos. O usuário precisa abrir o painel, voltar, copiar URL...

**Solução**: No card de edição de cada etapa (quando clicado), adicionar:
- Dropdown "Vincular Produto" que lista `projectProductsFull` com nome e preço
- Ao selecionar, preenche automaticamente URL (da oferta) e nome da etapa
- Badge mostrando o produto vinculado no card da etapa

**Arquivo**: `src/pages/Funis.tsx`

---

## Arquivos alterados/criados

| Arquivo | Acao |
|---|---|
| SQL migration | `system_prompt`, `versao`, `gatilho`, `cor` em `imphq_skills` |
| `src/pages/Skills.tsx` | Upload .md/.zip, campos novos no form, salvar system_prompt |
| `src/integrations/supabase/types.ts` | Atualizar tipos com novas colunas |
| `src/pages/Funis.tsx` | Select de projeto no editor, dropdown de produto por etapa |
| `package.json` | Adicionar `jszip` |


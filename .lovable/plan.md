Hoje os campos de tag (Nutrição, BulkEnroll, Tag→Projeto) são input livre. Vou trocar por um **seletor com sugestões** que puxa as tags reais já existentes nos leads.

## O que muda

1. **Novo hook `useLeadTags()`**
   - Consulta `imphq_leads.tags` (distinct, ordenado por frequência) e retorna `string[]`.
   - Cache leve em memória + revalidação ao abrir o componente.

2. **Novo componente `TagAutocomplete`** (substitui/complementa `EditableTagList`)
   - Mostra dropdown com as tags existentes conforme você digita.
   - Permite criar uma nova tag se nenhuma casar (enter).
   - Mesma aparência do `EditableTagList` atual (badges + input).

3. **Aplicado em 3 lugares**
   - `src/pages/Nutricao.tsx` → campo "Filtrar por tags do formulário".
   - `src/components/nurture/BulkEnrollDialog.tsx` → seleção de tags.
   - `src/components/configuracoes/TagRoutingRulesTab.tsx` → campo "tag" da regra.

## Fora de escopo
- Não mexer no editor de e-mails.
- Não alterar como as tags são salvas no lead.

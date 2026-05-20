# Nutrição por tags do formulário + roteamento por tag→projeto

Hoje o sistema já salva as `tags` do form em `imphq_leads.tags` (via `capture-lead`) e o `BulkEnrollDialog` até filtra por uma tag única. Faltam duas peças: **(1) sequência de e-mail que segmenta automaticamente por tag(s)** e **(2) regra global "tag X → projeto X"**.

## 1. Sequências de nutrição filtradas por tag

**Onde:** `imphq_nurture_sequences` + `Nutricao.tsx` + `nurture-scheduler` + `BulkEnrollDialog`.

- Adicionar coluna `filter_tags text[]` (default `{}`) e `filter_tags_mode text` (`any` | `all`, default `any`) em `imphq_nurture_sequences`.
- Na UI de "Nova sequência" (Nutrição IA), adicionar campo "Tags do formulário" (multi-tag, reaproveitar `EditableTagList`) + toggle "qualquer / todas".
- No `nurture-scheduler` e no auto-enroll (campanhas com `default_sequence_id`), aplicar `.contains("tags", filter_tags)` (modo `all`) ou `.overlaps("tags", filter_tags)` (modo `any`) ao selecionar leads elegíveis.
- `BulkEnrollDialog`: trocar input único de tag por multi-tag com o mesmo modo.

Resultado: você cria um form com tag `vip-cortes`, cria uma sequência "Nutrição VIP Cortes" com `filter_tags=['vip-cortes']`, e só esses leads entram.

## 2. Regra "tag X pertence ao projeto X"

**Onde:** nova tabela + hook no `capture-lead` (e no `membros-webhook`).

- Criar tabela `imphq_tag_project_rules` (`tag text`, `project_id text`, `priority int`, `user_id uuid`) com RLS por `user_id`.
- Tela simples de gestão dentro de **Configurações** (ou aba em Projetos): listar regras, criar/editar/remover (tag → projeto).
- No `capture-lead` (e `membros-webhook`), após resolver `tags`, se o lead não tiver `project_id` definido pelo form, consultar regras e atribuir `project_id` da primeira tag que casar (ordem por `priority`). Também aplicar em re-captura (lead existente sem `project_id`).
- Opcional: botão "Aplicar regras nos leads existentes" que faz backfill.

Resultado: qualquer lead que entrar (form, área de membros, import) com `tag=cortes` cai automaticamente no projeto "Cortes".

## Detalhes técnicos

- Migração SQL: `alter table imphq_nurture_sequences add column filter_tags text[] default '{}', add column filter_tags_mode text default 'any';` + `create table imphq_tag_project_rules(...)` com RLS (`auth.uid() = user_id`).
- Edge functions afetadas: `capture-lead/index.ts` (linhas ~90-160), `membros-webhook/index.ts` (bloco de upsert), `nurture-scheduler/index.ts` (seleção de leads), `nurture-auto-segment/index.ts` se relevante.
- Frontend: `src/pages/Nutricao.tsx` (form de criação), `src/components/nurture/BulkEnrollDialog.tsx` (multi-tag), nova página/aba `TagRoutingRules.tsx`.
- Performance: índice GIN em `imphq_leads.tags` já costuma existir; conferir antes de criar.

## Fora de escopo

- Não mexer no editor de e-mails das sequências.
- Não alterar comportamento atual de `default_sequence_id` em campanhas — só somar o filtro de tag.

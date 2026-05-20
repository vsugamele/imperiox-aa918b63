## Diagnóstico

Os leads atuais estão vindo via `membros-webhook` com `project_id=jp_freitas` enviado pelo sistema externo. Hoje a regra **Tag → Projeto** só é aplicada quando *não vem* `project_id` — por isso o roteamento por tag não está funcionando neste fluxo.

Tags reais que estão chegando: `MasterClass`, `Cobertura 1 Turma`, `asf-mai26`, `trafego-pago`, `area-membros`.

Projeto correto: `tatuagem` (Tatuagem — Jonathan).

## O que vou fazer

### 1. Reatribuir leads existentes
- Atualizar todos os leads com `project_id='jp_freitas'` + tag `asf-mai26` (ou `MasterClass`) para `project_id='tatuagem'`.
- Confirmação: rodar uma contagem antes para você aprovar o número.

### 2. Criar regra Tag → Projeto
- Inserir em `imphq_tag_project_rules`: tag `asf-mai26` → `tatuagem` (prioridade 1).
- Posso adicionar outras tags se você quiser (`MasterClass`, `Cobertura 1 Turma`).

### 3. Fazer a regra valer mesmo quando o webhook manda `project_id`
- Em `capture-lead/index.ts` e `membros-webhook/index.ts`: passar a checar a regra **sempre que houver tags**, e — se houver match — usar o projeto da regra como **override** (regra ganha do `project_id` recebido).
- Isso garante que daqui pra frente todo lead com `asf-mai26` cai no `tatuagem` automaticamente, mesmo se o sistema externo mandar `jp_freitas`.

### 4. Campanha / nutrição por tag (já existe, só usar)
- A nutrição já suporta filtrar por tags (`filter_tags` + `any/all`).
- Vou deixar pronto um passo na UI: criar uma sequência de e-mail filtrada por `asf-mai26` → só leads dessa tag entram.
- Pra disparo de WhatsApp em massa: o `BulkEnrollDialog` já filtra por tag.

## Detalhes técnicos

- Migration: apenas `UPDATE` + `INSERT` (sem mudança de schema).
- Edge functions: ajustar resolver de tag para rodar incondicionalmente quando `tags.length > 0`, mantendo precedência por `priority`.
- Sem mudanças de UI nesta etapa.

## Confirmação antes de executar

Antes de rodar o UPDATE em massa, me diga:
1. Reatribuir todos os leads com tag `asf-mai26` para `tatuagem`? (estimativa: ~todos os capturados hoje)
2. A regra principal deve ser `asf-mai26 → tatuagem`, ou prefere outra tag âncora?

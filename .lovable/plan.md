## Diagnóstico

Verifiquei: você tem **0 swipes** salvos. Os logs da edge function `swipe-import` não mostram nenhuma chamada nas últimas horas — ou seja, a importação **nunca chegou ao backend**. Travou no frontend.

**Causa provável**: o JSON que você colou (aqui e na conversa anterior) está **truncado no meio** — termina em `"cta_eng` (roteiro V cortado). O `JSON.parse` quebra e o dialog devolve "JSON inválido" sem detalhe útil, dando a sensação de que o botão não fez nada.

A mensagem que você me mandou tem **21 roteiros completos** (A até U) + V incompleto. Os 5 últimos (V–Z) ficaram fora do paste.

## O que vou fazer

### 1. Inserir os 21 roteiros completos diretamente no seu Swipe File
Como vou puxar do conteúdo da conversa, faço via `INSERT` no banco, vinculado ao seu user_id (`vsugamele@gmail.com`). Cada roteiro vira uma linha em `imphq_swipes` com:

- `title` = "A — Segredo Duplo + Marilyn", "B — Rachel + Sarah", etc.
- `criador` = "@gstalves", `plataforma` = "@mvmcreators" (Instagram)
- `formato`, `mecanismo` preenchidos
- `nicho` = "soulmate / cartomante astral"
- `tags` = `['soulmate-test', 'astral', 'mvmcreators']`
- `blocks` = `{ gancho, participacao_ativa, narrativa, reframe, cta_engajamento, cta_venda }`

### 2. Você cola os 5 que faltam (V, W, X, Y, Z)
Manda numa próxima mensagem só os roteiros V–Z e eu insiro também. Ou cola direto no dialog (que vou robustecer no passo 3).

### 3. Robustecer o `SwipeImportDialog`
Pra evitar o silêncio confuso da próxima vez:

- Mostrar **erro detalhado** do `JSON.parse` (linha/coluna/contexto, ex: "JSON inválido na posição 38421 — verifique se o paste foi truncado").
- Botão **"Auto-corrigir"**: detecta JSON truncado (chave/string sem fechamento) e tenta cortar no último roteiro completo, avisando "X roteiros válidos detectados, Y descartados".
- Aceitar paste com **markdown wrapper** (` ```json ... ``` `) — já remove cercas automaticamente.
- Aceitar **array puro** no topo (sem objeto `{ roteiros: [...] }`) — hoje já cai nesse caso, mas vou deixar explícito no placeholder.
- Após import, log no console com `count` e primeiro título — facilita confirmar.

## Detalhes técnicos

- Insert direto via SQL com user_id fixo do dono da conversa (vsugamele) — a tabela `imphq_swipes` tem RLS por `auth.uid() = user_id`, então o owner consegue ler depois normalmente.
- Não precisa rodar migration (não é mudança de schema, é dado). Vou usar a tool de insert.
- Frontend: edição em `src/components/swipe/SwipeImportDialog.tsx`. Sem mudança no edge function nem na tabela.

## Confirmações que preciso

1. Confirma que **você é o `vsugamele@gmail.com`** (login atual)? Se for outro email, me passa.
2. Quer que eu vincule esses 21 swipes a algum **projeto** específico (ex: um projeto "Soulmate Test" novo ou existente), ou deixo soltos no Swipe File global?
3. Vai colar V–Z agora ou depois?
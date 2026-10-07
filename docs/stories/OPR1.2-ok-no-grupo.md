# OPR1.2 — Decidir pelo grupo: "ok 1" no Imperio X

**Status:** Em andamento (07/10/2026) — código no ar; falta cadastrar o WhatsApp do time e o teste real

## Como funciona
- A rodada do operador (OPR1.1) numera as decisões que precisam de OK.
- No grupo Imperio X, alguém do time responde: `ok 1`, `ok 1 3`, `sim 2`, `não 2`, `pago 4` ou `ok 2: texto da resposta` (dúvida do bot).
- O webhook do WhatsApp repassa só mensagens do Imperio X que são comando para a function `operator-decide`.
- `operator-decide`: processa cada mensagem uma vez; reconhece quem mandou por `imphq_team_members.whatsapp_ids` (número e/ou @lid); liga os números à última rodada (24 h); decide pelo `project-mcp` (`decide_approval`) com `confirmado_por` = quem respondeu, então a autonomia continua valendo e tudo vai para o diário; responde no grupo com o resultado.
- Segurança: número não cadastrado não decide nada; dúvida do bot só é aprovada com o texto (o "ok" sozinho gravaria resposta genérica no acervo, que o bot repete a clientes).

## Acceptance Criteria
- [x] `parseOperatorCommand` / `resolveOperatorCommand` em `_shared/operator.ts` (testes)
- [x] Migração `20261007_imphq_team_whatsapp_ids.sql` (coluna `whatsapp_ids` no time)
- [x] `whatsapp-api` (webhook): mensagem de grupo grava `participant`, `participant_alt` e `push_name` em `metadata`; comando do Imperio X vai para `operator-decide` sem esperar. Versão no ar = HEAD antes de publicar; deno check sem erro antes/depois; publicado e conferido (sobe e responde 200)
- [x] Function `operator-decide` publicada
- [x] Teste de recepção: mensagem do Vinicius no Imperio X chegou ao banco (07/10 16:58 BRT). Antes, nenhuma mensagem do grupo estava gravada porque ninguém além do bot escrevia lá.
- [x] `whatsapp_ids` cadastrados com os números informados pelo Vinicius (07/10), com e sem o 9 depois do DDD. Se o grupo mandar o remetente como `@lid`, o primeiro "ok" responde "não reconheci (…xxxx)" sem executar nada e o id entra no cadastro.
- [ ] Teste real: rodada → "ok N" → decisão no diário e resposta no grupo

## File List
- `supabase/functions/_shared/operator.ts`, `src/test/operator.test.ts`
- `supabase/functions/operator-decide/index.ts` (novo)
- `supabase/functions/whatsapp-api/_lib/webhook-handler.ts`
- `supabase/migrations/20261007_imphq_team_whatsapp_ids.sql` (novo), `src/integrations/supabase/types.ts`

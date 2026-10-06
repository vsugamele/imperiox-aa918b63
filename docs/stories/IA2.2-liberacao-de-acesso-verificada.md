# IA2.2 — Liberação de acesso verificada pelo bot (JP)

**Status:** Done · 07/10/2026

## Contexto
Vinicius: "precisa ajustar área de membro pra liberar o usuário, porque ele comprou e ficou travado". O bot já reenviava link a quem tinha acesso ativo; quem comprou e não tinha o programa liberado ia para a equipe.

## Acceptance Criteria
- [x] Quando o lead pede ajuda com acesso, o bot procura no Império uma venda **aprovada** (pelo e-mail ou pelo telefone da conversa) de um produto com programa conhecido (CCP, Finalização Express, Corte Express) que ainda não está ativo.
- [x] Achou: cria a conta se ainda não existir (`create_account`, idempotente), libera só o programa da compra (`grant_access` com `source_ref` = venda), confere no cadastro que ficou ativo, gera o link de entrada no curso e responde "Encontrei sua compra do X e liberei seu acesso agora...".
- [x] Não achou, produto sem mapeamento, ou a liberação não aparece no cadastro: continua indo para a equipe, sem anunciar acesso. Pagamento alegado na conversa nunca libera nada; a tag `[JP_GRANT]` do modelo continua bloqueada.
- [x] Quem já tem acesso total (plano) não recebe liberação redundante.
- [x] Cada liberação vira ação `grantAccess` executada (source `wa-access-grant`) e aparece em "A IA fez" para revisão.

- [x] Instagram (direct): mesma liberação, localizando a compra pelo e-mail informado (o Instagram não dá telefone); ação `grantAccess` com source `ig-access-grant`.

## File List
- supabase/functions/_shared/jp-verified-grant.ts
- supabase/functions/_shared/crmBridgeJP.ts
- supabase/functions/wa-ai-reply/index.ts
- supabase/functions/instagram-webhook/index.ts
- supabase/functions/_shared/ai-feed.ts
- src/test/jp-verified-grant.test.ts

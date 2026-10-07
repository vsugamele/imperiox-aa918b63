# FUN1.3 — Order bumps da Ticto entrando como venda

**Status:** Done · 07/10/2026

## Contexto
O painel dizia "nenhum bump". O checkout do CCP (O854B666F) tem 3 bumps — O Segredo do Corte (R$ 47), A Arte da Finalização (R$ 37), O Poder do Tratamento (R$ 27). A Ticto manda os bumps comprados DENTRO do aviso da compra principal (`bumps[]`, valor pago total inclui os bumps); o `webhook-pagamento` gravava só o item principal. Em 60 dias: 30 pedidos do CCP, 8 com bump (27%), R$ 511 fora dos relatórios.

## Acceptance Criteria
- [x] `_shared/ticto-bumps.ts` + `webhook-pagamento`: em compra aprovada da Ticto, cada bump vira venda `orderbump` com a mesma transação, lead e UTMs; o índice único (projeto, transação, produto) impede duplicar em reenvio.
- [x] Bump não vira outro evento de compra na Meta (`meta_offline_synced_at` preenchido): a compra principal já foi com o pedido.
- [x] Backfill de 180 dias a partir dos avisos já recebidos: 38 bumps, R$ 1.656 (Arte da Finalização 17, Segredo do Corte 11, Poder do Tratamento 10), validado com 1 antes do lote.
- [x] Teste de criativos e placar: bump soma na receita do anúncio, mas não conta como outra venda.
- [x] Painel do funil: com produto escolhido, os bumps entram pelo pedido; a lista de produtos mostra só os principais.

## File List
- supabase/functions/_shared/ticto-bumps.ts
- supabase/functions/webhook-pagamento/index.ts
- supabase/functions/_shared/test-live.ts
- supabase/functions/_shared/funnel-live.ts
- src/hooks/useFunnelLive.ts
- src/hooks/useTestOrders.ts
- supabase/functions/project-mcp/index.ts
- supabase/functions/test-report-wa/index.ts
- src/test/ticto-bumps.test.ts
- src/test/test-live.test.ts

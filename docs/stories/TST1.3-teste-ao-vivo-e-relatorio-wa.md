# TST1.3 — Teste de criativos ao vivo no painel e relatório no WhatsApp

**Status:** Done · 06/10/2026

## Contexto
Vinicius pediu para acompanhar os resultados dos testes no painel do Império e receber o relatório no grupo Imperio X.
Decisões: relatório 2x/dia (10h e 19h BRT), grupo Imperio X.

## Acceptance Criteria
- [x] `/testes` mostra por ângulo gasto, IC, CTR, vendas reais (Ticto por UTM), CPA e a leitura da Esteira, atualizando a cada minuto, com a hora da última sincronização do Zernio.
- [x] Totais do teste: gasto, vendas, CPA, líquido e saldo.
- [x] Vendas que decidem são as da plataforma; o pixel aparece só como informação (no CCP ele contou 8 compras para 4 vendas reais).
- [x] "Vendendo" só para quem vendeu; qualificado sem venda aparece como "IC barato, sem venda ainda".
- [x] Função `test-report-wa` envia um relatório por teste no ar ao grupo Imperio X; `dry_run` para prévia; no máximo um envio a cada 2h por teste (salvo `force`); para após 3 falhas seguidas.
- [x] pg_cron `test-report-wa-10brt` (13h UTC) e `test-report-wa-19brt` (22h UTC).
- [x] Primeiro relatório enviado em 06/10.

## Limites conhecidos
- O gasto vem do Zernio a cada 6h (9h20, 15h20, 21h20, 3h20 BRT); o relatório das 19h usa o gasto das 15h20.
- A função aceita a chave pública (como as demais do cron); proteger na etapa de segurança.

## File List
- supabase/functions/_shared/test-live.ts
- supabase/functions/test-report-wa/index.ts
- supabase/migrations/20261006_imphq_test_report_wa_cron.sql
- src/hooks/useTestOrders.ts
- src/pages/Testes.tsx
- src/test/test-live.test.ts
- src/test/testes-page.test.tsx

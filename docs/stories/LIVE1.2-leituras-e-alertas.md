# LIVE1.2 + LIVE1.4 — Leituras a cada 15 min, alertas no grupo e painel no MCP

**Status:** Done (07/10/2026) · Épico: `EPIC-LIVE1-painel-ao-vivo.md`

## Acceptance Criteria
- [x] `imphq_live_snapshots` (projeto, hora, dia, gasto, faturamento, vendas, CPA, zona, ROAS, lucro, painel completo) com leitura para autenticados e limpeza de 30 dias (`imphq_prune_live_snapshots`, roda às 06h UTC dentro da rotina)
- [x] `_shared/live-panel-load.ts`: mesmo carregamento da tela com o cliente do servidor; projetos ativos = venda no checkout (30 d), gasto (7 d) ou tracker (7 d)
- [x] `liveAlerts()` (puro): só mudança de estado vira alerta — CPA saiu do alvo (ESCALA/LUCRATIVA → MAGRA/PREJUÍZO), voltou ao alvo, pixel × checkout divergindo; mínimo de 3 vendas para alertar CPA; intervalo por tipo (2 h para CPA, 12 h para rastreio)
- [x] Function `live-snapshot` (com `dry_run` e `project_id`): grava a leitura, compara com a anterior do dia, envia ao grupo Imperio X pelo provider ativo de `imphq_wa_providers`, registra em `imphq_activity_log` (`live_alert`), para após 3 falhas seguidas de envio
- [x] Cron `live-snapshot-15m` (`*/15 * * * *`), migração `20261007_imphq_live_snapshot_cron.sql` (desligar documentado)
- [x] Tela: o "vs HH:MM" usa a última leitura gravada de hoje diferente da atual (sobrevive a recarregar); reserva = comparação da sessão
- [x] MCP `get_live_panel`: painel atual + variação desde a última leitura gravada + leituras do dia
- [x] Zernio volta a contar como fonte de gasto (Vinicius, 07/10): `imphq_v_ads_sync_health` com Meta e Zernio, um caminho funcionando basta; cron de anúncios do Zernio ativo (migração `20261007_imphq_zernio_ads_source.sql`)
- [x] Testes: alertas (3), saúde do sync com Zernio (3), MCP `get_live_panel` (1); suíte verde; typecheck e lint limpos

## Validação real (07/10, dry_run)
5 projetos ativos (JP, HorseJello, Vigor Boost, SlimSoda, MemoFlow). JP: gasto R$ 80,32 (Zernio), 1 venda, alerta de rastreio (pixel 4 × checkout 1).

## Próximo
- Gráfico do dia com as leituras (gasto × faturamento) na tela.
- Leitura também no resumo diário (`daily-briefing-wa`) e no `get_briefing`.

## File List
- `supabase/migrations/20261007_imphq_live_snapshots.sql`, `20261007_imphq_live_snapshot_cron.sql`, `20261007_imphq_zernio_ads_source.sql` (novos)
- `supabase/functions/_shared/live-panel.ts`, `supabase/functions/_shared/live-panel-load.ts` (novo)
- `supabase/functions/live-snapshot/index.ts` (novo), `supabase/functions/project-mcp/index.ts`
- `src/hooks/useLivePanel.ts`, `src/integrations/supabase/types.ts`
- `src/test/live-panel.test.tsx`, `src/test/mcp-approvals-briefing.test.ts`, `src/test/map-agent-status-mcp.test.ts`

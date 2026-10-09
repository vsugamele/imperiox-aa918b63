# TRK1.4 — Tráfego da página do anúncio do CCP no funil do Tracker

Status: Feito · 09/10/2026

Origem: o Tracker do JP mostrava 2 visitantes em 7 dias com R$ 875 gastos e 349 visitas registradas pela Meta. Os anúncios do teste de ângulos levam para `codigodoscortesperfeitos.vercel.app` (fora da conta Vercel do Império; o `funnel.js` está só em `jphaireducation.com/codigo1`). Essa página usa o tracker antigo inline, que grava em `imphq_events` (787 visitas, 742 com UTM) e não em `imphq_funnel_events`, que o Tracker lê.

## Critérios

- [x] Causa do projeto vazio: `imphq_events_fill_project` rodava como anon e o RLS de `imphq_project_domains` escondia o domínio já cadastrado; 780 eventos sem projeto desde 03/10. Função passa a `security definer`; 30 dias corrigidos (metadata.backfill = TRK1.4).
- [x] Gatilho `imphq_events_bridge_legacy` copia PageView/ViewContent/AddToCart/InitiateCheckout/Lead do tracker antigo para `imphq_funnel_events` (event_id `legacy_<id>`, meta.source = legacy_events), só com UTM ou fbclid; falha da ponte nunca derruba a gravação original.
- [x] Histórico de 30 dias: 1.013 visitas (751 da campanha `ccp-teste-angulos-0510`, 812 visitantes).
- [x] Testado com rollback, inclusive gravando como anon; validação (`codex-validation`) marcada como teste.

## Limites

- A página do anúncio não manda clique no botão de compra; o funil dela vai da visita direto para a venda.
- O `visitor_id` que chega da Ticto é da própria Ticto; a ligação visita → venda segue por UTM/fbclid.
- O insert em `imphq_clicks` da página antiga continua falhando (colunas `page_url`/`user_agent`/`referrer` não existem); sem efeito agora que a ponte cobre as visitas.
- Para medir clique no botão e usar o `funnel.js` atual, trocar o script da página (dono da conta Vercel onde ela está) ou apontar os próximos anúncios para `jphaireducation.com/codigo1`.

## File List

supabase/migrations/20261009_imphq_legacy_events_bridge.sql; docs/stories/TRK1.4-ponte-tracker-antigo.md.

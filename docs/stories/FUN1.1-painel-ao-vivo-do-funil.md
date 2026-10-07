# FUN1.1 — Painel ao vivo do funil

**Status:** Done · 07/10/2026

## Contexto
Vinicius: "como conseguir ver nos funis do projeto/produto os resultados dos ads, do fluxo... falta informação pra montar e acompanhar o funil, estratégia e métricas". Ordem combinada: 1) painel ao vivo, 2) teste A/B/C de página, 3) ~~banco de fotos do expert~~ (descartado: o foco dos criativos é testar ângulos, formatos e ideias), 4) limpeza visual dos mapas.

## Acceptance Criteria
- [x] Funis → "Painel ao vivo": projeto, produto e período (hoje, 7, 14, 30 dias).
- [x] Totais: gasto, faturamento, líquido, saldo, ROAS, CPA.
- [x] Etapas em linha com números reais: Anúncio (Zernio), Página (rastreador `imphq_page_metrics`), Checkout (pixel ou rastreador + pedidos), Venda (plataforma), Bump e upsell (`tipo_venda`), Recuperação no WhatsApp (régua enviada → pagou).
- [x] Conversão entre etapas com referência de mercado; status ok/atenção/gargalo/sem dado/medição incompleta; gargalo destacado.
- [x] Dado ausente aparece como ausente; páginas sem rastreador e pixel que conta repetido viram "medição incompleta" (não gargalo).
- [x] MCP `get_funnel_live`.

## Leitura real JP (7 dias, 07/10)
Gasto R$ 399, CTR 1,8%, 11 vendas, CPA R$ 36; página mede 114 visitas para 305 cliques (falta rastreador em parte das páginas); nenhum bump/upsell registrado.

## File List
- supabase/functions/_shared/funnel-live.ts
- src/hooks/useFunnelLive.ts
- src/components/funis/FunnelLivePanel.tsx
- src/pages/Funis.tsx
- supabase/functions/project-mcp/index.ts
- src/test/funnel-live.test.ts
- src/test/funnel-live-panel.test.tsx

# FUN1.2 — Teste A/B/C de página

**Status:** Done · 07/10/2026

## Acceptance Criteria
- [x] `imphq_page_splits` (teste, variantes com URL e peso, status, vencedor) e `imphq_split_hits` (cada envio), com RLS do time.
- [x] Função pública `split` (`/functions/v1/split/<slug>`): escolhe a página pelo peso, mantém UTMs/fbclid, acrescenta `imp_split`/`imp_var`, cookie de 30 dias para a pessoa voltar à mesma página; teste encerrado com vencedor manda 100% para a vencedora sem trocar o anúncio; slug inexistente → 404. Testada ponta a ponta (302 com UTMs, registro do envio, 404).
- [x] Leitura por variante: enviados, visitas, cliques no botão e checkouts do rastreador (por URL), conversão; vencedora só com 100 visitas por página e 20% de vantagem; página sem rastreador sinalizada.
- [x] Painel ao vivo → "Testes de página (A/B/C)": criar (2–3 páginas, pesos), copiar link, acompanhar e encerrar.
- [x] MCP: `create_page_split`, `get_page_splits`, `end_page_split`.

## Limites
- Vendas por página ainda não: a plataforma devolve só UTMs; a conversão usa checkouts (ou cliques no botão) medidos pelo rastreador.
- O link usa o domínio do Supabase; um domínio próprio pode ser apontado depois.

## File List
- supabase/migrations/20261007_imphq_page_splits.sql
- supabase/functions/_shared/page-split.ts
- supabase/functions/split/index.ts
- supabase/config.toml
- src/hooks/usePageSplits.ts
- src/components/funis/PageSplitsSection.tsx
- src/components/funis/FunnelLivePanel.tsx
- src/integrations/supabase/types.ts
- supabase/functions/project-mcp/index.ts
- src/test/page-split.test.ts
- src/test/page-splits-section.test.tsx
- src/test/funnel-live-panel.test.tsx

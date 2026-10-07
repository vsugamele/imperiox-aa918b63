# Story REF2.2 — Mineração diária da Biblioteca de Anúncios

**Status:** Done · **Data:** 2026-10-07

## Contexto
A biblioteca de referências dependia de alguém salvar anúncio na mão. Para rodar 20 criativos/dia (SlimSoda VSL), a IA precisa de matéria-prima nova todo dia, com prova de que funciona (tempo no ar e variações).

## Critérios de aceite
- [x] Tabela `imphq_mining_sources` (projeto, tipo palavra/página/url, valor, país, limite, ativo, última rodada)
- [x] Função `ref-mining` (Apify `facebook-ads-scraper`): modos run / source / probe; até 6 fontes por rodada, 50 anúncios por fonte; para após 3 falhas seguidas
- [x] Escolhe os anúncios há mais tempo no ar (mín. 7 dias) e com mais variações, sem repetir os que já existem (`external_id`)
- [x] Baixa a mídia para o Storage (link do Facebook expira) e grava em `imphq_referencias` já com projeto, lote `mineracao-AAAA-MM-DD` e metadados (`pipeline.mineracao`)
- [x] Cron `ref-mining-daily` 06:15 BRT; o `ref-pipeline` transcreve, lê e classifica depois
- [x] Card "Mineração diária" em Estratégias → No mercado: adicionar fonte, rodar agora, pausar, resultado da última rodada
- [x] MCP: `list_mining_sources`, `add_mining_source`, `run_mining`
- [x] Testes: `ad-mining.test.ts`, `mining-sources.test.tsx`

## Validação
Fonte de teste SlimSoda "weight loss drink" (US, limite 3): 10 anúncios vistos, 3 gravados com mídia, processados pelo pipeline. Custo ≈ US$0,006 por anúncio.

## File List
- supabase/migrations/20261007_imphq_mining_sources.sql
- supabase/functions/_shared/ad-mining.ts
- supabase/functions/ref-mining/index.ts
- supabase/functions/project-mcp/index.ts
- src/hooks/useMiningSources.ts
- src/components/estrategias/MiningSources.tsx
- src/components/estrategias/MarketAngles.tsx
- src/integrations/supabase/types.ts
- src/test/ad-mining.test.ts, src/test/mining-sources.test.tsx, src/test/market-angles.test.tsx

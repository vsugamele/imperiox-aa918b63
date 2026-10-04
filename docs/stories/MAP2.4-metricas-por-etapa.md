# MAP2.4 — Métricas por etapa, URL e projeto

Status: Em andamento · 04/10/2026
Escopo autorizado: opção 1 da revisão dos itens 5/6. Implementação @dev, schema @data-engineer, validação @qa, publicação @devops. Piloto SlimSoda; reaproveitar visão Caminho e fontes existentes.

## Critérios

- [x] Conferir visão Caminho, contadores existentes e schema completo de nós/eventos.
- [x] Identificar total de um projeto aplicado a todo o mapa e ausência dos novos eventos da VSL na fonte consultada.
- [x] Calcular métricas de página por projeto + URL, sem misturar ofertas do mapa.
- [x] Integrar tracker novo e legado sem duplicar uma mesma sessão/clique.
- [x] Excluir validação identificada; distinguir ausência de fonte, zero e erro.
- [x] Mostrar escopo, fonte e atualização, preservando metas e entrada manual existentes.
- [x] Validar SlimSoda com dados reais antes das outras três ofertas.
- [x] Configurar somente métricas justificadas por tipo/URL nos nós autorizados.
- [ ] Passar gates e publicar com conferência de produção.
- [ ] Registrar handoff e atualizar critérios.

Cliques em links para checkout não são checkouts iniciados nem compras. Métricas de receita/CPA continuam no projeto até existir atribuição confiável por página.

## File List

- docs/stories/MAP2.4-metricas-por-etapa.md

## Piloto e regressões

RPC imphq_page_metrics aplicada; seguida pela correção de taxas na mesma coorte. Slim própria: 4 sessões na VSL, 1 no ADV1, zero CTA de operação; 14 eventos identificados como validação excluídos. Node piloto af110007-0000-4000-8000-000000000003 ligado à métrica e confirmado com os mesmos 4 eventos agregados. Depois, outras 11 etapas vazias das quatro ofertas receberam sessões_pagina; metas preexistentes intactas.

8 verificações da RPC real em transação revertida: dedup de visualizações/CTAs/IC, coorte de taxa, fontes combinadas, validação excluída, zero x sessão desconhecida, isolamento por projeto. Zero fixtures persistentes. 13 testes de atribuição/tela/volume passaram.

Gates completos: 697 testes em 106 arquivos; typecheck passou inclusive após regenerar os tipos completos do schema vivo; lint sem erros (duas advertências preexistentes); build de produção passou. Tipos regenerados sem edição parcial para manter a checagem de drift existente.

## Arquivos de implementação
- supabase/migrations/20261004_imphq_page_metrics.sql
- supabase/migrations/20261004_imphq_page_metrics_cohort.sql
- supabase/tests/map_stage_metrics.sql
- supabase/functions/_shared/metric-keys.ts
- supabase/functions/_shared/flow-volume.ts
- src/lib/map-stage-metrics.ts
- src/hooks/useMapPathMetrics.ts
- src/hooks/useMapFlowVolume.ts
- src/components/funis/CompanyMapCanvas.tsx
- src/components/funis/MapPathView.tsx
- src/integrations/supabase/types.ts
- src/test/map-stage-metrics.test.ts
- src/test/map-path-view.test.tsx
- src/test/flow-volume.test.ts
- src/test/centro-imports-views.test.tsx

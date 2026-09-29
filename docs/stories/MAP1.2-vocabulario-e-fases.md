# Story MAP1.2 — Vocabulário de elementos, seções/fases e regra única de lacunas do funil

Pedido: trazer para o Império os elementos do Make Systems que ajudam a construir e explicar funis, sem perder o diferencial do Império (o mapa é lido pela IA e cruzado com dados reais). Unificar a regra de lacunas do funil, que existia só no painel do canvas (`strategic-gaps.ts`).

## Critérios de aceite
- [x] Catálogo único `supabase/functions/_shared/map-elements.ts` (TS puro): 96 tipos em 8 famílias (Tráfego e redes, Páginas, Ofertas e produto, Ações e eventos, Comunicação, Integrações, Estrutura, Mídia), cada um com fase do funil (Aquisição, Conversão, Ascensão, Relacionamento, Operação).
- [x] Os 26 tipos existentes mantêm chave, rótulo e cor (mapas salvos não mudam) — coberto por teste.
- [x] Canvas usa o catálogo: paleta por família, busca por nome, atalho "Seção / fase" (moldura que move as etapas de dentro) e "Mudar tipo" agrupado.
- [x] Regra de lacunas do funil em `supabase/functions/_shared/funnel-gaps.ts`, reconhecendo tipos equivalentes (ex.: Sequência de WhatsApp conta como WhatsApp). `src/components/funis/strategic-gaps.ts` reexporta a regra.
- [x] Mapa da Empresa: seção Funil por fase e lacunas estruturais vindas da mesma regra (tela e MCP `get_project_map`).
- [x] Validado no navegador com dados reais (paleta, busca e funil do JP por fase).
- [x] lint + typecheck + test (423) + build verdes.

## Achados
- Mapa do JP: etapas com tipo genérico ou trocado ("Meta Ads" como Canal genérico, "Obrigado → Grupo VIP" como Anúncio, produtos como "Oferta" em vez de orderbump/upsell). Com o vocabulário novo, basta reclassificar no canvas.
- `/funis` demora ~1 min para abrir em modo dev (centenas de módulos na primeira compilação). Em produção o bundle é pré-compilado.

## Próximo (MAP1.3)
- Elementos vivos: ações/eventos (Gerou PIX, Carrinho abandonado, Compra), integrações e comunicação ligados a contagens e status reais.
- Camada "Operações" (começando pelo Orgânico / Central de Comando).

## File List
- supabase/functions/_shared/map-elements.ts
- supabase/functions/_shared/funnel-gaps.ts
- supabase/functions/_shared/project-map.ts
- supabase/functions/project-mcp/index.ts
- src/components/funis/map-element-presets.ts
- src/components/funis/strategic-gaps.ts
- src/components/funis/companyMapHelpers.ts
- src/components/funis/CompanyMapCanvas.tsx
- src/hooks/useCompanyMap.ts
- src/test/map-elements.test.ts

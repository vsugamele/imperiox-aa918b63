# Story MAP2.3 — Visão "Caminho" do mapa

Pedido (03/10/2026, backlog "Mapa difícil de entender"): deixar óbvio os passos, o resultado de cada um, as métricas, o caminho principal × alternativas e onde está travado.
Decisões do Vinicius: caminho principal automático pelas setas com ajuste manual; botão Mapa | Caminho no canvas; cada passo mostra entrega, métrica × meta e onde travou.

## Feito (03/10/2026)
- [x] Regra `_shared/map-path.ts`:
  - caminho principal = maior sequência de setas que termina na compra (senão no checkout); setas que voltam na ordem (ciclos) não contam;
  - alternativas agrupadas pelo passo do principal de onde saem; "depois da venda" (tudo que vem depois do fim); "fora do caminho" (sem ligação);
  - ajuste manual por etapa (`path_role`: principal / alternativa / automático);
  - onde travou = primeiro passo do principal não feito, com motivo (status, sem dono, atrasada);
  - meta escrita lida como régua ("acima de 80%", "5% a 15%", "até o CPA alvo", "payout ÷ CPA alvo", "CPA alvo ÷ ICs") com os parâmetros da esteira de escala; "definir…", "ajustar…" e proporções "a cada" ficam sem régua; verde no alvo, amarelo até 20% fora, vermelho além.
- [x] Coluna `imphq_company_map_nodes.path_role` (migração `20261003_imphq_map_nodes_path_role.sql`, aplicada).
- [x] Função `imphq_project_metrics(projeto, desde)` (migração `20261003_imphq_project_metrics.sql`, aplicada): valores de 7 dias das chaves do catálogo com fonte ativa; sem dado = null. Métricas de etapa (sessões, cliques para o checkout) saem no nível do projeto nesta versão.
- [x] `MapPathView` + botão Mapa | Caminho na barra do canvas: linha numerada do principal, entrega (SAÍDA / PRONTO QUANDO), métrica real × meta com cor, aviso "Travado no passo N", ramos de alternativas, "depois da venda", "fora do caminho" recolhido; "Ver no mapa" volta ao canvas centrado na etapa e abre o detalhe.
- [x] Conferido nos mapas reais: SlimSoda (Avatar → … → Checkout H&W → Compra; esteira P1–P4, advertoriais e VSL como ramos) e JP (principal pelo X1; funil do Webinar como alternativa).
- [x] Testes: `src/test/map-path.test.ts` (regra) e `src/test/map-path-view.test.tsx` (tela). Suíte 660 verde, lint sem erros, typecheck.

## Pendente
- [ ] Conferência visual logado (o preview local caiu no login em 03/10).
- [ ] JP: decidir se o caminho principal é o Webinar ou o X1 (hoje o automático escolheu o X1); ajustar pelo menu do passo.
- [ ] Métricas por etapa (sessões e cliques na URL de cada página) em vez do total do projeto.
- [ ] Hoje quase tudo aparece "sem dado": falta gasto de anúncio (token da Meta / contas DTC) e parâmetros da esteira de escala na SlimSoda.

## File List
- supabase/functions/_shared/map-path.ts
- supabase/migrations/20261003_imphq_map_nodes_path_role.sql
- supabase/migrations/20261003_imphq_project_metrics.sql
- src/components/funis/MapPathView.tsx
- src/components/funis/CompanyMapCanvas.tsx
- src/components/funis/map-node-model.ts
- src/integrations/supabase/types.ts
- src/test/map-path.test.ts
- src/test/map-path-view.test.tsx
- docs/stories/MAP2.3-visao-caminho.md

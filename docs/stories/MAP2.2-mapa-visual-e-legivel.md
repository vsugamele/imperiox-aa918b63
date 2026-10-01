# Story MAP2.2 — Mapa bonito, claro e legível para pessoas e IAs

Pedido (01/10/2026): melhorar o desenho dos mapas, fluxo, imagens e prints, deixando cada etapa clara para as IAs. Decisões do Vinicius: fazer tudo nesta ordem; os contratos das etapas eu preencho sem revisão prévia.

## 1. Cartão de etapa novo
- [x] Cartão extraído do canvas para `src/components/funis/MapNodeCard.tsx` (modelo em `map-node-model.ts`); canvas caiu de 3.919 para ~3.530 linhas.
- [x] Ordem de leitura: número da etapa, tipo, status declarado → título (15px) e papel → print → "o que faz" (objetivo do contrato ou 1ª frase da descrição) → quem executa e skill → progresso e o que falta → WhatsApp, indicador e link.
- [x] Fora: selos "não verificado" e o "CADASTRO" piscando; fonte mínima 11px; cores pelos tokens do tema.
- [x] Print aparece em qualquer tipo de etapa (antes só no tipo "imagem").
- [x] Testes: `src/test/map-node-card.test.tsx`.

## 2. Prints automáticos
- [ ] Bucket público `map-prints` + campo `print_meta` na etapa.
- [ ] `scripts/map-prints.mjs` (CLI): abre cada URL de etapa com Playwright, print de computador e celular, sem disparar pixel/tracker, envia ao Storage e liga à etapa.
- [ ] Rodar em SlimSoda e JP.

## 3. Fluxo legível
- [ ] Numeração automática seguindo as setas.
- [ ] Setas com rótulo e estilo pelo tipo do que passa.
- [ ] Modo apresentação (sem paleta e barras) e exportação do mapa.

## 4. Contrato de cada etapa para as IAs
- [ ] Objetivo, entrada, saída, pronto quando, métrica e se falhar em todas as etapas de SlimSoda e JP.
- [ ] MCP devolve etapa numerada + contrato + print.

## File List
- src/components/funis/MapNodeCard.tsx
- src/components/funis/map-node-model.ts
- src/components/funis/CompanyMapCanvas.tsx
- src/test/map-node-card.test.tsx
- docs/stories/MAP2.2-mapa-visual-e-legivel.md

# Story CSX1.1 — Cinna Shield script com IA

## Escopo aprovado
Opção 1: roteiro conduz e IA trata interrupções. Criar sistema local revisável e pacote de integração posterior no Império, sem ativar mensagens reais. Preservar os outros projetos.

## Critérios de aceite
- [x] Nove etapas rastreáveis ao Typebot; original preservado.
- [x] Dúvidas não consomem pergunta pendente; compra antecipada, parada e humano tratados.
- [x] Oferta ausente ou placeholder nunca gera link de compra.
- [x] IA opcional com saída estruturada validada e fallback explícito.
- [x] CLI e simulador local usam o mesmo motor, sem banco ou envio Meta.
- [x] Contrato documentado para adaptação ao OpenFlow e canais.
- [x] Testes do motor, CLI, HTTP e interface; lint e checagem de tipos executados.

## File List
src/lib/cinna-shield-x1/engine.ts; src/test/cinna-shield-x1-engine.test.ts; scripts/cinna-shield-x1/{run.mjs,flow.yaml,simulator.html,simulator.css,simulator.js,verify-http.mjs,README.md}; docs/architecture/{cinna-shield-x1.md,cinna-shield-media-review.md}; docs/sessions/2026-09/2026-09-07-cinna-shield-x1.md.

## Estado
Implementação local validada. 81 testes passaram; lint focal e tipos passaram. Lint global bloqueado por 5.049 erros e 155 avisos em arquivos existentes. IA externa não configurada; canais não conectados. Checkout/oferta aguardam confirmação; mídias revisadas e separadas por problemas de conteúdo.

# Story CYC1.1 — Ciclo operacional por objetivo

## Pedido e aceite

Império coordena projetos com objetivo, estratégia, conhecimento, ativos, execução e resultado econômico. Reutilizar MAP1.x, IA1.1, OPR1.x, OPS1.3/1.4, TST1.x, REF2.x e TRK1.1. Arquitetura: `docs/architecture/project-operating-cycle.md`.

- [x] Verificar capacidades existentes e validar arquitetura/PO antes do código.
- [x] Motor puro prioriza próximas ações e explicita dependências, autonomia e verificação.
- [x] Loader reúne fontes reais isoladas por projeto, com erro/ausência/antiguidade explícitos.
- [x] Consulta e registro idempotente pelo MCP; objetivo reutilizado do diário (handlers testados; deploy confirmado).
- [x] CLI funciona sem UI nova e sem credenciais em argumentos.
- [x] Testar falhas, fontes incompletas, replay e isolamento.
- [x] Validar piloto SlimSoda com dados reais, sem modificar campanhas/ativos.
- [x] Rodar lint, typecheck, testes e build; registrar limitações.
- [x] Handoff criado e mudanças preparadas em commit próprio; distinguir local de produção.
- [ ] Chamada autenticada ao novo MCP publicado: chave não disponível nesta sessão; não rotacionar credenciais existentes.

## File List

- docs/architecture/project-operating-cycle.md
- docs/stories/CYC1.1-project-operating-cycle.md
- supabase/functions/_shared/project-cycle.ts
- supabase/functions/_shared/project-cycle-load.ts
- supabase/functions/project-mcp/index.ts
- scripts/project-cycle.mjs
- src/test/project-cycle.test.ts
- src/test/project-cycle-load.test.ts
- src/test/mcp-approvals-briefing.test.ts
- .gitignore
- docs/sessions/2026-10/2026-10-11-project-operating-cycle.md

## Limites desta entrega

Coordenação e registro de evidências/propostas. Executores externos e rotinas existentes preservados. Não é autonomia total de produção; os próximos contratos estão registrados na arquitetura.

## Evidência

- Piloto: SlimSoda, 48 etapas, 18 páginas/URLs cadastradas no mapa, 100 referências lidas (teto declarado).
- Diário real: `e9c4af59-aab1-4ec7-ad82-92dd4a1c074c`; replay confirmado sem duplicação e sem execução externa.
- MCP v107 ACTIVE, dois módulos novos presentes e duas ferramentas publicadas. Sem autenticação retorna 401. Antes do deploy, os 37 arquivos da v106 eram iguais ao HEAD local.
- 36 testes específicos passaram; typecheck e build passaram; lint dos arquivos desta entrega passou. Suíte completa final: 1028 passaram, 8 falharam em UGC/custos, 12 erros assíncronos em testes existentes. Lint global tem 13 erros em arquivos não alterados (detalhes no handoff).

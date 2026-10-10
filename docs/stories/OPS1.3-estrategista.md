# Story OPS1.3 — Estrategista: a próxima leva de criativos

**Status:** Done (código) · **Data:** 2026-10-10 · **Rodando:** nada sozinho (sem cron, sem IA, não gera arte)

## Contexto
A biblioteca do Renan (78 ângulos), os 13 formatos e as referências mineradas existiam, mas nada juntava isso em volume
para testar. Vinicius escolheu a opção 1: Estrategista + formato no placar.

## Critérios de aceite
- [x] `_shared/batch-strategist.ts`: leva de N (padrão 20) — com vencedor 50% variações / 30% ângulos novos / 20% formatos novos; sem vencedor 70/30; ângulos nunca testados e não mortos, priorizando o que o mercado roda e espalhando por camada; formato do mercado por ângulo; porta/ponto/carga do Método H&W (5 portas na leva, pontos 1/2, carga nunca "bloco"); só formatos de imagem por padrão
- [x] Coluna `formato` em `imphq_test_variants`; placar por formato (tela e MCP); classificador do Revisor pergunta o formato
- [x] Função `batch-strategist` (plano · salvar como leva planejada · aprovar · descartar), sem gerar arte
- [x] Painel "Próxima leva" na tela de Testes; MCP `plan_batch`; skill `metodo-hw` atualizada
- [x] Testes: `batch-strategist.test.ts`, `next-batch-panel.test.tsx`

## Próximo (opção 2)
Fábrica gerar as imagens de uma leva aprovada (ângulo da biblioteca + formato + referência do mercado como modelo).

## File List
- supabase/migrations/20261010_imphq_test_variants_formato.sql
- supabase/functions/_shared/batch-strategist.ts, hw-taxonomy.ts, method-scoreboard.ts
- supabase/functions/batch-strategist/index.ts, creative-review/index.ts, project-mcp/index.ts
- src/hooks/useBatchStrategist.ts, src/components/testes/NextBatchPanel.tsx, src/pages/Testes.tsx
- src/integrations/supabase/types.ts
- src/test/batch-strategist.test.ts, next-batch-panel.test.tsx, testes-page.test.tsx, hw-method.test.ts
- .claude/skills/metodo-hw/SKILL.md, docs/architecture/maquina-de-testes.md

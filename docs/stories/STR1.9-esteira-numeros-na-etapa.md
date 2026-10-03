# STR1.9 — Esteira de Escala: números na etapa do mapa

**Status:** Done (02/10/2026)

## Objetivo
Parte D da STR1.8: lançar os números de cada fase da esteira na própria etapa do mapa, com veredito ao vivo, histórico por projeto e o placar de hipóteses disponível para a IA.

## Acceptance Criteria
- [x] Tabela `imphq_scale_rounds` (projeto, etapa, fase, rodada, parâmetros, números, veredito salvo, resumo) com RLS; migração aplicada
- [x] A etapa sabe a fase pela marca do playbook (`[agent_playbook:esteira-escala-dtc#N]`: 3 parâmetros, 4–6 P1, 7 P2, 8 P3, 9 P4)
- [x] Painel da etapa (`StepScaleLadder`): parâmetros com tetos derivados, tabelas por fase, veredito por linha ao vivo, rotina do dia (P3), checkpoint do dia 2 (P2), placar de hipóteses (P1), resumo da rodada
- [x] Abre na última rodada da fase; sem rodada, herda os últimos parâmetros do projeto; "Nova rodada"; histórico clicável
- [x] "Puxar do Império": gasto, checkouts iniciados e compras de `imphq_ads_spend` por conjunto/dia (P1 2 dias, P2 3 dias, P3/P4 7 dias), mantendo hipóteses e contadores já escritos
- [x] Salvar grava o veredito calculado por `_shared/scale-ladder.ts` e o resumo de uma linha
- [x] MCP `get_scale_rounds` (rodadas + placar de hipóteses acumulado, resultado mais recente vale)
- [x] Testes: `step-scale-ladder.test.tsx` (6), MCP (+1); suíte 623 verde; typecheck, lint, build; deno check na linha de base (9); `project-mcp` publicado

## Piloto (03/10)
- [x] CLI `scripts/playbook.mjs` (list / apply com plano e `--confirmar`; mesmo planejador e gravador do MCP, transação única com snapshot do mapa)
- [x] Esteira aplicada na SlimSoda (decisão delegada pelo Vinicius): 8 etapas novas + avatar e ângulos reaproveitados, 10 setas, 6 seções

## Limites conhecidos
- O painel só aparece em etapas criadas pelo playbook `esteira-escala-dtc` (hoje: SlimSoda).
- O sync de anúncios só tem dados do JP até 19/08 (sync do Facebook parado); a SlimSoda não tem conta conectada. Sem dados, o botão avisa e o lançamento é manual.
- Conferência visual logado pendente (a prévia local exige login); validado por teste de renderização.

## File List
- `scripts/playbook.mjs` (novo), `.gitignore`
- `supabase/migrations/20261002_imphq_scale_rounds.sql` (novo)
- `src/integrations/supabase/types.ts`
- `supabase/functions/_shared/scale-ladder.ts`
- `src/hooks/useScaleRounds.ts` (novo)
- `src/components/funis/StepScaleLadder.tsx` (novo)
- `src/components/funis/CompanyMapCanvas.tsx`
- `supabase/functions/project-mcp/index.ts`
- `claude-skills/07-esteira-escala.md`
- `src/test/step-scale-ladder.test.tsx` (novo), `src/test/mcp-approvals-briefing.test.ts`

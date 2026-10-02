# STR1.8 — Esteira de Escala DTC como conhecimento do Império

**Status:** Done (02/10/2026) — partes A, B e C. Parte D (números na etapa do mapa) fica para a próxima story.

## Origem
AffHub (`vsugamele/imphafilliate`, Supabase `sxiqbhcnkzrrenzgncss`): calculadora da esteira em `index.html` (`estZona`, `renderEstP1..P4`). O banco do AffHub tinha só 2 ângulos e 1 rodada salva, então o que veio foi o método, não dados. Direção do Vinicius: isso é conhecimento para aplicar nos projetos e nas consultas da IA, não uma tela de calculadora.

## Acceptance Criteria
- [x] A. Playbook `esteira-escala-dtc` na biblioteca (família x1_ads, 10 etapas: avatar, ângulos, parâmetros, concepts com hipótese, P1 campanha, P1 veredito e placar, P2, P3, P4, revisão semanal), gravado no banco pelo `scripts/playbooks-seed.ts`
- [x] Métrica nova `custo_por_ic` no catálogo
- [x] B. Motor `_shared/scale-ladder.ts` com as regras exatas do AffHub: parâmetros derivados, zonas do CPA, vereditos P1 (+ placar de hipóteses), P2 (dias, checkpoint, conjuntos), P3 (rotina, escada do lance, ângulos), P4 (cemitério)
- [x] MCP `evaluate_scale` (fase regras/parametros/p1/p2/p3/p4), sem escrita no banco
- [x] C. `claude-skills/07-esteira-escala.md` (Guia Claude e Claude Projects)
- [x] Testes: `scale-ladder.test.ts` (13), MCP (evaluate_scale), suíte 616 verde; deno check na linha de base (9); `project-mcp` publicado

## Próximo (D)
- Lançar números do P1–P4 na própria etapa do mapa (manual + puxar gasto/vendas do Império), com veredito ao vivo.
- Guardar ângulos e placar de hipóteses por projeto como aprendizado.
- Trazer do AffHub: 61 criativos, 53 dissecações, 28 anúncios de concorrentes (opção 2).

## File List
- `supabase/functions/_shared/scale-ladder.ts` (novo)
- `supabase/functions/_shared/playbook-library.ts`
- `supabase/functions/_shared/metric-keys.ts`
- `supabase/functions/project-mcp/index.ts`
- `claude-skills/07-esteira-escala.md` (novo), `claude-skills/README.md`
- `src/pages/ClaudeSkillsGuide.tsx`
- `src/test/scale-ladder.test.ts` (novo), `src/test/mcp-approvals-briefing.test.ts`, `src/test/map-agent-status-mcp.test.ts`

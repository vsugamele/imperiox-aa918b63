# LAUNCH1.3 — Lançador de projetos

**Status:** Done (03/10/2026) · Épico: `EPIC-LAUNCH1-lancador-de-projetos.md`

## Objetivo
"Vamos fazer um canal de YouTube de cripto" ou "projeto com YouTube, SEO, tráfego direto e X1" vira, numa chamada: projeto + mapa de operação + estratégias dos canais aplicadas + kit de acessos com o que só uma pessoa faz.

## Acceptance Criteria
- [x] `_shared/launch-plan.ts`: id do projeto pelo nome, mercado padrão EUA (EN), nome do mapa com os canais; playbooks planejados em sequência no mesmo mapa (etapa comum reaproveitada, não duplicada); etapa "Kit de acessos" (humano, checklist dos acessos obrigatórios); recusa id repetido, nome vazio e pedido sem canal
- [x] `writeLaunch` com writer abstrato: projeto → mapa → kit → playbooks (etapas reaproveitadas ligadas ao id real) → acessos "falta"; setas não se repetem entre playbooks
- [x] CLI `scripts/launch.mjs novo --nome --canais [--id --mercado --produto] [--ensaio | --confirmar]`: plano por padrão; `--ensaio` grava tudo no banco real e desfaz (prova o SQL sem deixar nada); `--confirmar` cria numa transação só
- [x] MCP `launch_project` (plano por padrão; `confirmar=true` grava e, se falhar no meio, desfaz projeto, mapa, aplicações e acessos)
- [x] Testes: `launch-plan.test.ts` (5) + MCP (+2, incluindo falha no meio); suíte 641 verde; typecheck e lint limpos; deno check na linha de base (9); `project-mcp` publicado

## Ensaio com os exemplos do Vinicius (03/10, nada criado)
- **Lei da Atração** (YouTube, SEO, tráfego direto, X1): 5 playbooks, 35 etapas novas + 9 reaproveitadas, 10 acessos obrigatórios. Começar por: conta Google, domínio, Business Manager, checkout, WhatsApp. `--ensaio` ok no banco real.
- **Crypto Signals** (YouTube): 1 playbook, 12 etapas, 2 acessos (conta Google → canal verificado).

## File List
- `supabase/functions/_shared/launch-plan.ts` (novo)
- `scripts/launch.mjs`
- `supabase/functions/project-mcp/index.ts`
- `src/test/launch-plan.test.ts` (novo), `src/test/mcp-approvals-briefing.test.ts`, `src/test/map-agent-status-mcp.test.ts`

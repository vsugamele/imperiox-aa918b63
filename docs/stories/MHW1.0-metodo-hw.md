# Story MHW1.0 — Método H&W dentro do Império (MHW1.1 a MHW1.6)

**Status:** Done (código) · **Data:** 2026-10-10 · **Rodando:** nada novo (sem cron, sem ação em anúncio; política e diagnóstico desligados por padrão)

## Contexto
Os materiais da H&W (Playbook CBO, Trilha de Copy 01–05, Fundamentos do DR) ensinam um piloto a escolher, ler, adaptar
e multiplicar criativos. Vinicius pediu para virar regra, campo e agente no Império, e para o Claude usar o método no
dia a dia ("manda bala em tudo, só não vamos rodar nada"). Desenho: `docs/architecture/metodo-hw-na-imperio.md`.

## Critérios de aceite
- [x] **MHW1.1 Taxonomia** — colunas `ponto_rota`, `carga`, `porta`, `pouso`, `molde_*`, `taxonomia`, `revisao` em `imphq_test_variants`; `_shared/hw-taxonomy.ts` (vocabulário, pergunta ao Jev, leitura firme/dúvida, avisos da leva); placar por porta/carga/ponto/pouso; etiquetas e selo do Revisor na tela de Testes
- [x] **MHW1.2 Revisor** — `_shared/hw-review.ts` (teste do print, abertura, cartão de bolso, compliance; regras fixas + Jev "noul"; correções permitidas só em número/pronome/ponte com a imagem); função `creative-review` (só grava etiqueta firme em campo vazio)
- [x] **MHW1.3 Diagnóstico** — `_shared/hw-telemetry.ts` (hook, hold, CTR, CPC, connect, IC; estágio que falhou e correção, comparando com os pares da oferta); opção `diagnostico: true` no agente de tráfego
- [x] **MHW1.4 Política CBO** — `_shared/cbo-policy.ts` (escada ~32/45/85% do payout, teto de CPC com exceção de venda+ROAS, 48h, 3 vendas valida, 4 vira escala, receita da P2); opção `politica: "cbo_hw"` no agente de tráfego, mesma autonomia de sempre
- [x] **MHW1.5 Molde Vencedor** — `_shared/winner-mold.ts` (fila V01–V05, trava do V04/V05, ondas, brief com script travado); função `winner-mold` (desmontar → V00; onda → briefs, sem gerar)
- [x] **MHW1.6 Microlead** — `_shared/microlead.ts` (7 etapas, checagem, pesos do split); função `microlead-writer` (rascunho, não mexe em página)
- [x] **Motor no dia a dia** — MCP: `get_hw_method`, `review_creatives`, `set_method_tags`, `diagnose_ads`, `cbo_plan`, `winner_mold`, `microlead_draft`, `get_method_scoreboard` com as réguas; skill do projeto `.claude/skills/metodo-hw`
- [x] Testes: `hw-method.test.ts` (20), `traffic-agent.test.ts` (+3)

## Para ligar (decisão dos sócios)
- `imphq_scale_rounds.params.politica = "cbo_hw"` e/ou `diagnostico = true` por projeto (+ `cpc_max`, `formato`)
- Rodar `review_creatives` nos testes atuais (gasta Jev/Gemini por criativo)

## File List
- supabase/migrations/20261010_imphq_hw_method.sql
- supabase/functions/_shared/hw-taxonomy.ts, hw-review.ts, hw-telemetry.ts, cbo-policy.ts, winner-mold.ts, microlead.ts
- supabase/functions/_shared/method-scoreboard.ts, traffic-agent.ts
- supabase/functions/creative-review/index.ts, winner-mold/index.ts, microlead-writer/index.ts
- supabase/functions/traffic-agent/index.ts, project-mcp/index.ts
- src/pages/Testes.tsx, src/integrations/supabase/types.ts
- src/test/hw-method.test.ts, src/test/traffic-agent.test.ts
- .claude/skills/metodo-hw/SKILL.md
- docs/architecture/metodo-hw-na-imperio.md

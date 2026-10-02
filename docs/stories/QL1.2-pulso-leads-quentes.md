# QL1.2 — Pulso do projeto: leads quentes lendo o campo certo

**Status:** Done (02/10/2026)

## Problema
`useProjectPulse` filtrava `imphq_vendas.last_intent_at`, coluna que não existe. O `webhook-pagamento` grava a intenção em `data->>last_intent_at`. A consulta falhava e o KPI "leads quentes" (faixa de KPIs do projeto e carrossel mobile) mostrava sempre 0.

## Acceptance Criteria
- [x] Consulta usa `data->>last_intent_at` (mesmo padrão de `TodayCard` e `ImperiusSuggestionsTab`)
- [x] Dado real confirmado: JP tem 283 vendas pendentes com intenção registrada
- [x] typecheck, lint e testes (596) verdes

## File List
- `src/hooks/useProjectPulse.ts`

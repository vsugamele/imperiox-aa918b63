# Semana 3 — Inteligência & Receita

Objetivo: transformar dados que já temos em ações que geram receita. Foco em recuperação, hot leads e ações automáticas do Imperius — sem novas integrações.

## 1. Hot Lead Auto-Action ⏳

Hoje o pipeline detecta lead quente (Pix/Boleto em 2h) mas a ação fica pendente no inbox. Mudança:
- Para leads com score ≥ 80 + intent de Pix < 30min → Imperius dispara WhatsApp INLINE (não fila), igual ao `hot-lead-responder` mas sem esperar cron.
- Log obrigatório em `imphq_ai_actions` com `risk='medium'` (auto-executa) e link para conversa.

## 2. Recuperação inteligente ⏳

`Recuperacao.tsx` hoje mostra buckets. Adicionar:
- Botão "Disparar campanha" por bucket → cria step de WhatsApp em massa via `BulkSendDialog` já existente.
- Sugestão de copy do Imperius por bucket (ex: bucket 24h usa tom de urgência, 7d usa tom de quebra de objeção).

## 3. Dashboard "Próxima Ação" ⏳

Card no topo do Dashboard (acima de `TodayCard`) com **1 única ação** que o Imperius recomenda agora:
- "Disparar recovery do bucket 48h (R$ X em risco)"
- "Responder 3 hot leads esperando há > 15min"
- "Pausar campanha X (CPA 3× meta)"
Fonte: query `imphq_ai_actions` ordenada por `impact_score` desc.

## 4. Predições acionáveis ⏳

`PredictiveDashboard` já mostra forecast. Adicionar:
- Se `funnel_health < 50` → mostrar CTA "Ver gargalo" abrindo modal com o stage problemático e ação sugerida.
- Linkar previsão de receita com meta de `imphq_metas` (se existir): "Para bater R$ Y faltam Z vendas/dia".

## Ordem

1. Card "Próxima Ação" no Dashboard (mais visível, mais barato)
2. Recuperação: botão de disparo + copy IA por bucket
3. Hot Lead auto-action (já tem infra, só trocar enfileiramento por inline)
4. Predições com CTA de gargalo

## Fora de escopo

- Nova edge function. Reutilizar `hot-lead-responder`, `imperius-scout`, `imperius-executor`.
- Schema novo. Só `imphq_ai_actions` (já existe).

Ao terminar: Semana 4 (Polish & QA).

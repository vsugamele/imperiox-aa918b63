# TRF1.1 — Agente de tráfego (substitui o ads-ai-optimizer)

**Status:** No ar (07/10/2026) — primeira rodada real amanhã 09:00 BRT; falta conferir o aviso e a primeira decisão pelo grupo

## Decisões do Vinicius (07/10)
- JP: payout R$ 47, CPA alvo R$ 25 (gravados em `imphq_scale_rounds`, fase "parametros").
- Autonomia: opção 2 — pausa sozinho só prejuízo claro; o resto é proposta. Também identificar ofensores e sugerir alternativas.
- "Sim, substituir" o ads-ai-optimizer.
- O pixel duplica (26 compras no pixel × 8 vendas reais em 06/10): contar só o que gerou de fato = vendas do checkout pela UTM. Order bump soma no faturamento, não conta como venda.

## Como funciona
- Function `traffic-agent`, todo dia 09:00 BRT (cron `traffic-agent-0900brt`), antes da rodada do operador das 09:30.
- Projetos: os que têm payout e CPA alvo na Esteira e gasto por anúncio no Zernio nos últimos 7 dias.
- Venda por anúncio: UTM de conteúdo ("07-publico::…") casada com o nome do anúncio pelo número e pela palavra.
- Regras (`_shared/traffic-agent.ts`):
  - **Pausa sozinho**: anúncio ativo, gasto ≥ 3× o CPA alvo, nenhuma venda real (autonomia `trafego:pausar_prejuizo_claro`, padrão auto). Passa pelo `imperius-executor` → `zernio-ads-toggle`, fica no histórico e dá para desfazer em /imperius.
  - **Proposta** (fila, "ok N" na rodada): gasto ≥ 2× sem venda; CPA acima do payout com 2+ vendas, ou 1 venda e gasto ≥ 3×.
  - **Observar**: CPA magro, ou acima do payout com 1 venda só (uma venda não é prova).
  - **Escalar** (recomendação): zona ESCALA com 3+ vendas, ~20% no conjunto, uma mexida por dia.
  - **Ofensores**: top 3 por gasto além do que as vendas justificam pelo CPA alvo.
  - **Alternativas**: duplicar e gerar variações do vencedor; sem vencedor, ângulos novos.
  - Vendas com UTM de anúncio que não casaram com nenhum anúncio aparecem no aviso (UTM orgânica não conta).
- Aviso no grupo Imperio X só quando há algo além de "manter". Um anúncio com ação do agente nas últimas 24 h não ganha outra.

## Acceptance Criteria
- [x] `_shared/traffic-agent.ts` + testes (`src/test/traffic-agent.test.ts`, 6)
- [x] Painel ao vivo: bump fora da contagem de vendas e do checkout preenchido, dentro do faturamento
- [x] `imperius-executor`: `pauseAd` com `payload.via = "zernio"` pausa e desfaz pelo `zernio-ads-toggle` (versão no ar = HEAD antes de publicar)
- [x] Function `traffic-agent` publicada; dry-run no JP conferido (10 anúncios, R$ 541,74, 7 vendas reais: 3 propostas, 1 escalar, 4 observar)
- [x] Cron `traffic-agent-0900brt` ligado; `ads-ai-optimizer` desligado (não apagado) — migração `20261007_imphq_traffic_agent_cron.sql`
- [ ] Primeira rodada real (08/10 09:00 BRT): aviso no grupo e propostas numeradas na rodada das 09:30
- [ ] Primeira pausa decidida por "ok N" executada no Zernio

## File List
- `supabase/functions/_shared/traffic-agent.ts` (novo), `src/test/traffic-agent.test.ts` (novo)
- `supabase/functions/traffic-agent/index.ts` (novo)
- `supabase/functions/imperius-executor/index.ts`
- `supabase/functions/_shared/autonomy.ts`
- `supabase/functions/_shared/live-panel.ts`, `supabase/functions/_shared/live-panel-load.ts`, `src/hooks/useLivePanel.ts`, `scripts/live.mjs`, `src/test/live-panel.test.tsx`
- `supabase/migrations/20261007_imphq_traffic_agent_cron.sql` (novo)

# LIVE1.1 — Painel ao vivo do projeto: regra e tela

**Status:** Done (03/10/2026) · Épico: `EPIC-LIVE1-painel-ao-vivo.md`

## Acceptance Criteria
- [x] `_shared/live-panel.ts`: funil (visitas → checkout iniciado → checkout preenchido → pedidos) com conversões; parcial (gasto, faturamento, vendas, CPA com zona da Esteira de Escala, ROAS, lucro, ticket); pendentes (pix/boleto) e reembolsos; ritmo e projeção do dia; alertas de rastreio
- [x] Fonte em cada número, com prioridade: pedidos/faturamento = webhook > Meta; visitas/checkout = tracker > Meta; checkout preenchido = todo registro do webhook (aprovado, abandonado, pix, recusado…); gasto = sync de anúncios. Sem fonte, não inventa número
- [x] Com checkout e Meta ao mesmo tempo, o card mostra os dois números; divergência > 20% vira alerta
- [x] Painel no topo do projeto (`LivePanel`, abaixo da faixa de KPIs), relido a cada minuto, com "variação vs HH:MM" da leitura anterior da sessão
- [x] CLI `scripts/live.mjs --project <id> [--dia AAAA-MM-DD]` com a mesma regra
- [x] Correção: o sync grava checkouts iniciados em `init_checkout` (`checkouts_iniciados` chega zerada); corrigido também no "Puxar do Império" da Esteira (STR1.9)
- [x] Testes `live-panel.test.tsx` (6) + esteira atualizada; suíte 647 verde; typecheck, lint e build limpos

## Validação com dado real (JP)
- 02/07: Meta com R$ 17,4 mil de gasto, 8.296 checkouts e 748 compras no pixel; webhook com 1 venda → painel mostra os dois e o alerta de divergência (o checkout não estava mandando as vendas ao Império nesse período).
- 03/10: 1 pedido pelo webhook; alertas de gasto não sincronizado e tracker sem eventos.

## File List
- `supabase/functions/_shared/live-panel.ts` (novo), `supabase/functions/_shared/scale-ladder.ts`
- `src/hooks/useLivePanel.ts` (novo), `src/hooks/useScaleRounds.ts`
- `src/components/projeto/LivePanel.tsx` (novo), `src/pages/ProjetoDetalhe.tsx`
- `scripts/live.mjs` (novo), `.gitignore`
- `src/test/live-panel.test.tsx` (novo), `src/test/step-scale-ladder.test.tsx`

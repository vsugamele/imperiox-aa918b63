# OPR1.1 — Operador diário (rodada priorizada no grupo)

**Status:** Em andamento (07/10/2026) — código e prévia prontos; cron aguardando OK do Vinicius

## Objetivo
Um operador que junta todo dia o que o Império já sabe de cada projeto e diz ao time, em uma mensagem, o que importa: dinheiro em risco, decisões que precisam de OK e atrasos por dono — e o que a IA já fez sozinha.

## Decisões
- Usa o próprio `project-mcp` (get_briefing + get_live_panel) com a chave do servidor: lê e decide como uma IA conectada, sem duplicar regra.
- v1 não executa decisões: quase tudo que mexe em algo real está no nível "aprovar" (`_shared/autonomy.ts`, 05/10). Prioriza, cobra e numera as decisões.
- OPR1.2: responder "ok 1" / "não 2" no grupo executa a decisão com `confirmado_por` de quem respondeu (o registro `operator_round` já guarda as decisões numeradas).

## Acceptance Criteria
- [x] `_shared/operator.ts` (puro): por projeto, 🔴 dinheiro (CPA em MAGRA/PREJUÍZO com ≥ 3 vendas, gasto sem venda acima do CPA alvo, pixel × checkout, alertas de pagamento/sync) → 🟠 decisões que precisam de OK (até 3, numeradas) → 🟡 atrasos agrupados por dono; projeto sem nada fica de fora; contagem do que a IA/bot fez desde a última rodada; assinatura para não repetir rodada igual
- [x] Function `operator-round` (`dry_run`, `force`): projetos ativos, MCP com `x-imperio-actor: operador`, envio único ao grupo Imperio X pelo provider ativo, registro `operator_round` em `imphq_activity_log` com as decisões numeradas
- [x] Testes `operator.test.ts` (3); lint e deno check limpos; publicada
- [x] Prévia real (07/10 16:49): 5 projetos lidos; JP com divergência pixel × checkout e 3 dúvidas do bot esperando 23 h (uma de cliente que comprou e não recebeu)
- [ ] Cron 09:30, 14:00 e 19:30 BRT — depois do OK na prévia

## File List
- `supabase/functions/_shared/operator.ts` (novo)
- `supabase/functions/operator-round/index.ts` (novo)
- `src/test/operator.test.ts` (novo)

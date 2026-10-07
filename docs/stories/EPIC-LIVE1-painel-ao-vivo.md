# Épico LIVE1 — Painel ao vivo do projeto

**Origem (03/10/2026):** print de um painel de checkout + "Parcial" (gasto, faturamento, vendas, CPA no alvo, ROAS, lucro, vs leitura anterior, ritmo/projeção) que o Vinicius mandou como **conceito** para aplicar em todos os projetos. Fontes: Meta Ads, webhooks das plataformas de checkout e tracker do Império.

## Regra central
Cada número diz de que fonte veio. Prioridade: pedidos e faturamento = webhook do checkout (`imphq_vendas`) > Meta (`compras`/`valor_conversao`); visitas e checkout iniciado = tracker do Império > Meta (`landing_page_views`/`checkouts_iniciados`); gasto = sync de anúncios. Fontes que discordam viram alerta de rastreio.

## Stories
- [x] **LIVE1.1 — Regra e painel**: `_shared/live-panel.ts` (funil, parcial, CPA × alvo da esteira, ritmo e projeção, alertas, fonte por número) + painel no projeto com "vs leitura anterior" na sessão.
- [x] **LIVE1.2 — Leituras e alertas** (07/10, `LIVE1.2-leituras-e-alertas.md`): `imphq_live_snapshots` a cada 15 min (pg_cron), gráfico do dia, "vs HH:MM" persistente, aviso no grupo quando o CPA sai do alvo ou pixel × webhook divergem (com limite anti-spam).
- [ ] **LIVE1.3 — Fontes**: consertar o sync da Meta (sem dado desde 19/08), tracker no checkout com `project_id` (hoje os `InitiateCheckout` chegam sem projeto), webhooks das plataformas usadas (Whop, CartPanda, ClickBank…), MGID e outras fontes de tráfego.
- [x] **LIVE1.4 — IA** (MCP `get_live_panel` feito em 07/10; resumo diário pendente): MCP `get_live_panel` e o painel no resumo diário/`get_briefing`.

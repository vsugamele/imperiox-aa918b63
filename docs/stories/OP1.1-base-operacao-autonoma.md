# Story OP1.1 — Base da operação autônoma

Pedido (02/10/2026): o Império rodar rotinas de conteúdo e venda (YouTube, 20 páginas de Facebook, GeeLark, Drive, ads, X1) com o máximo de métricas para achar gaps e oportunidades, e o Claude ler tudo, propor e operar no dia a dia. Decisões do Vinicius: base primeiro; primeira esteira completa = GeeLark (TikTok/IG em farm).

## 1. Rotinas duplicadas (feito em 02/10)
Pares do mesmo job no pg_cron disparavam a mesma função duas vezes; o briefing das 9h chegava em dobro (jobs 97 e 99 às 12:00 UTC, sem checagem de envio). Desativados (não apagados) com `cron.alter_job(id, active := false)`:

| Desativado | Continua | Função |
|---|---|---|
| 97 daily-briefing-wa-09brt | 99 daily-briefing-wa | briefing 9h no WhatsApp |
| 12 daily-briefing-job | 14 daily-briefing-morning | daily-briefing |
| 77 checkout-abandoned-scanner-15min | 105 checkout-abandoned-scanner | carrinho abandonado |
| 13 payment-recovery-30min | 100 payment-recovery (15 min) | recuperação de pagamento |
| 101 hot-lead-responder (30 min) | 25 hot-lead-responder-5min | hot lead |
| 70 wa-weekly-report-monday | 106 wa-weekly-report (grupo Imperio X) | relatório semanal |
| 2 clean_old_receipts | 1 clean_old_receipts | limpeza |

- [x] 7 jobs desativados, par de cada um conferido ativo.
- [x] `imphq_cron_jobs.hot-lead-responder` marcado `is_enabled = false` (a tela de Configurações mostrava ligado).
- Para reativar um: `select cron.alter_job(<id>, active := true);`
- Observação: `run_cron_job` grava "success" logo após enfileirar o `net.http_post`, antes da resposta; o status da tela não prova que a função respondeu 200.

## 2. Pendente
- [ ] Conectar o `project-mcp` a esta máquina (precisa de uma chave do MCP; ver handoff).
- [ ] Modelo único de conteúdo e métricas (contas, peças, postagens, métricas diárias, atribuição por UTM).
- [ ] Esteira GeeLark ponta a ponta (story própria).

## File List
- docs/stories/OP1.1-base-operacao-autonoma.md

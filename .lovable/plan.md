

## Diagnóstico: 3 vendas hoje, mas só 1 aparece

Confirmei no banco — hoje (21/04) há **3 registros** do "Código dos Cortes Perfeitos" (JP Freitas):

| Hora | Status | Aparece? |
|---|---|---|
| 14:37 | `aprovado` ✅ | Sim |
| 12:52 | `pix_gerado` ⏳ | Não |
| 22:25 | `pix_gerado` ⏳ | Não |

**Causa**: o sistema todo (Dashboard, Finanças, Charts, Alerts) filtra `status = 'aprovado'`. PIX gerado mas não pago **não conta como venda** — o que é o comportamento correto financeiramente (não pode contabilizar receita de PIX que pode expirar).

Se a Ticto realmente confirmou o pagamento dos 3, o webhook de aprovação **não chegou** ou **não atualizou** os 2 registros de `pix_gerado` → `aprovado`.

### Plano de correção

**1. Diagnóstico do webhook (read-only primeiro)**
- Conferir `imphq_webhook_logs` das últimas 24h pra ver se a Ticto enviou eventos de aprovação pros 2 PIX órfãos (12:52 e 22:25).
- Se enviou e falhou → bug no `webhook-pagamento` ao casar transação existente.
- Se não enviou → problema do lado da Ticto (webhook de aprovação não configurado ou pagamento não confirmado de fato).

**2. Botão "Reprocessar PIX pendentes"** (Finanças → Visão Geral)
- Lista todos os PIX/Boleto com `status = 'pix_gerado'` das últimas 48h.
- Permite **forçar consulta de status** na Ticto/Hotmart via API e atualizar pra `aprovado` se já foi pago.
- Útil pra recuperar webhooks perdidos sem depender de retry da plataforma.

**3. KPI "PIX pendentes" no Dashboard**
- Card extra no `DashboardStats` mostrando: **N PIX gerados hoje (R$ X em pipeline)**.
- Clique abre o `DashboardDrillSheet` listando os PIX com link pra contato (WhatsApp do lead) e botão de reprocessar.
- Resolve o ponto cego — você vai enxergar PIX em aberto que precisam de follow-up.

**4. Edge Function `payment-recovery` (já existe!)** 
- Verificar se está rodando e se tem cron ativo. Pode estar parada — os logs mostram só `shutdown`.
- Reativar o cron pra polling automático de PIX pendentes a cada X horas.

### Arquivos afetados
- `supabase/functions/payment-recovery/index.ts` — revisar lógica de polling Ticto
- `src/components/financas/FinancasOverview.tsx` — botão "Reprocessar PIX pendentes"
- `src/components/dashboard/DashboardStats.tsx` — card "PIX pendentes hoje"
- `src/components/dashboard/DashboardDrillSheet.tsx` — nova métrica `pix_pendentes`
- Migration: cron `pg_cron` chamando `payment-recovery` a cada 30min (se não existir)

### Resposta direta à pergunta
**Não apareceu porque 2 das 3 vendas estão como `pix_gerado`, não `aprovado`.** O sistema só conta venda quando o pagamento é confirmado. Se você confirma na Ticto que os 3 já pagaram, o webhook de aprovação falhou e precisamos reprocessar.

### Fora de escopo
- Mudar a regra global pra contar PIX gerado como venda (seria errado — infla receita).


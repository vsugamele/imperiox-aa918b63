
## Análise

**Pedido 1**: Criar um guia explicando como usar webhooks/API/snippet pra receber dados de leads de áreas de membros e webinars externos.

**Pedido 2**: Roberta e Maria aparecem como aprovadas com valor dentro, mas a coluna "Receita" no painel não mostra. Vou investigar.

## Investigação rápida

Já temos `membros-webhook` (criado anteriormente) + `capture-lead` + `webhook-pagamento`. O guia precisa documentar tudo isso de forma clara, no contexto certo (página Leads → aba Formulários).

Para a receita não aparecer: provavelmente vendas dela não têm `lead_id` linkado (vendas vêm pelo webhook de pagamento, mas o match com lead é por email/phone). O `LeadsTable` mostra `total_gasto` direto da coluna do lead. Se as vendas não estão linkadas via `lead_id`, o `total_gasto` continua zero mesmo após o recálculo da migration anterior.

## Plano

### 1. Componente `MembrosWebhookGuide.tsx` (novo)
Guia visual completo dentro de `src/components/leads/` com:
- **Aba "Webhook"**: URL pronta (`https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/membros-webhook`), exemplos de payload por evento (membro_cadastrado, webinar_inscrito, webinar_assistido, prova_enviada, pesquisa_respondida), botão copiar
- **Aba "API JS"**: snippet `fetch()` pronto pra colar em qualquer site/área de membros
- **Aba "Snippet HTML"**: tag `<script>` plug-and-play que captura form submit
- **Aba "Tags & UTMs"**: como passar `tags`, `utm_source`, `origem` para segregação
- **Aba "Eventos"**: tabela com cada `event_type` + pontos atribuídos + status resultante

### 2. Integrar no `Leads.tsx`
Adicionar botão "📡 Integrações Externas" na aba Formulários que abre o guia em Sheet/Dialog.

### 3. Fix de receita não aparecendo (Roberta/Maria)
Investigar via SQL se vendas dela têm `lead_id` preenchido. Se não, criar migration de **backfill** que faz match retroativo por email/phone:
```sql
UPDATE imphq_vendas v 
SET lead_id = l.id
FROM imphq_leads l
WHERE v.lead_id IS NULL 
  AND (LOWER(v.email) = LOWER(l.email) OR v.phone = l.phone);
```
Depois re-rodar o recálculo de `total_gasto`.

Também ajustar `webhook-pagamento` para sempre tentar linkar `lead_id` no momento da venda.

## Arquivos
- `src/components/leads/MembrosWebhookGuide.tsx` (novo)
- `src/pages/Leads.tsx` (botão + dialog)
- Migration: backfill `lead_id` em vendas órfãs + recalcular `total_gasto`
- `supabase/functions/webhook-pagamento/index.ts` (garantir match lead_id)

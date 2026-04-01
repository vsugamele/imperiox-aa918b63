

# Plano: Corrigir data de compra usando a data real do webhook

---

## Problema

Quando o webhook da Hotmart (ou outra plataforma) chega, o sistema insere a venda (`imphq_vendas`) e o lead (`imphq_leads`) usando `now()` do banco como `created_at`. Se 3 vendas dos dias 24/03 e 01/04 chegam todas no dia 01/04, todas ficam com data 01/04.

O payload da Hotmart traz a data real em `body.data.purchase.approved_date` ou `body.data.purchase.order_date`. O código atual ignora esses campos.

---

## Solução

No `parseWebhookBody`, extrair um campo `data_compra` (data real da transacao) de cada plataforma:

- **Hotmart**: `body.data.purchase.approved_date` ou `body.data.purchase.order_date`
- **Kiwify**: `body.sale_date` ou `body.created_at`
- **Ticto**: `body.order.created_at` ou `body.order.approved_at`
- **Generico**: `body.data_compra` ou `body.created_at`

Ao inserir em `imphq_vendas`, usar `created_at: data_compra || new Date().toISOString()`.

Ao inserir em `imphq_leads` (novo lead), usar `criado_em: data_compra || undefined` (para que leads antigos tenham a data correta).

Ao inserir em `imphq_events` (jornada), usar `created_at: data_compra` para que a timeline reflita quando o evento realmente aconteceu.

---

## Arquivo alterado

| Arquivo | Acao |
|---|---|
| `supabase/functions/webhook-pagamento/index.ts` | Extrair `data_compra` do payload e usar nos inserts de vendas, leads e eventos |


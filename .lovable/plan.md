
# Plano: Corrigir valor da venda Ticto (usar preco do item, nao do pedido)

## Causa raiz

Linha 177 do webhook: `valor = (order.paid_amount || 0) / 100`

`order.paid_amount` e o **total do pedido** (produto + bumps). Para a Maiara: produto R$47 + bump R$27 = R$74 total. O sistema grava R$74 como venda "principal", inflando a receita.

O correto e usar `item.price` (preco individual do item em centavos) para o valor da venda, e `order.paid_amount` apenas para o breakdown financeiro.

## Mudancas

### 1. Webhook: usar preco do item

```
// ANTES
valor = (order.paid_amount || 0) / 100;

// DEPOIS
valor = (item.price || item.amount || order.paid_amount || 0) / 100;
```

Manter `order.paid_amount` no `extractFinanceiro` como `valor_bruto` (total do pedido).

### 2. Corrigir venda existente da Maiara

SQL para ajustar o valor da venda ja gravada (de 74 para 47), caso `item.price` confirme ser 4700.

Nao podemos garantir sem ver o payload original, mas como o produto custa R$47 e a comissao e R$32,98 (~70% de 47), o valor correto e 47.

### 3. Gravar bump como venda separada (se vier no mesmo webhook)

Verificar se Ticto v2 envia `order.bumps[]` ou `order.items[]` — se sim, criar vendas separadas com `tipo_venda = "orderbump"`.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/webhook-pagamento/index.ts` | Usar `item.price` em vez de `order.paid_amount` para valor individual |
| Migracao SQL | Corrigir valor da venda da Maiara (74 → 47) |



# Plano: Capturar tarifas/comissoes e exibir no lead

## Problema

O webhook salva apenas `valor` (bruto) na `imphq_vendas`, mas a plataforma (Ticto, Hotmart, Kiwify) envia breakdown completo: comissao da plataforma, taxa de transacao, comissao do produtor, valor liquido. Esses dados se perdem. O order bump ja funciona (campo `tipo_venda` existe e e parseado).

## Solucao

### 1. Extrair breakdown financeiro no webhook-pagamento

No `parseWebhookBody`, extrair campos adicionais para um objeto `financeiro` que sera salvo no `imphq_vendas.data`:

**Ticto v2**: `body.order` contem `paid_amount`, `net_amount`, `platform_fee`, `transaction_fee`; `body.commissions` contem array de comissoes (produtor, afiliado, coprodutor).

**Hotmart**: `body.data.purchase.price` contem `value`, `currency`; `body.data.purchase.commission` e `body.data.purchase.price.value`.

**Kiwify**: `body.sale_amount`, `body.commissions`.

Mapear para formato padrao:
```
{
  valor_bruto: number,
  comissao_plataforma: number,
  taxa_transacao: number,
  comissao_produtor: number,
  comissao_afiliado: number,
  valor_liquido: number,
  metodo_pagamento: string,
  parcelas: number,
  codigo_pedido: string
}
```

Salvar esse objeto dentro de `imphq_vendas.data` (JSONB, ja existe).

### 2. Exibir breakdown na secao "Dados de Compra" do lead

Na area que ja mostra vendas do lead (linha ~1544), adicionar sub-secao "Tarifas e Comissoes" quando `v.data?.valor_bruto` existir:

```
Valor da Venda     R$ 47,00
Comissão Plat.   - R$ 3,29
Taxa Transação   - R$ 2,49
Comissão Prod.   - R$ 8,24
Sua Comissão       R$ 32,98
```

### 3. UTMs do webhook ja na venda

Tambem salvar UTMs do body do webhook em `imphq_vendas.data.utms` para rastreabilidade (ja existe logica de UTMs no lead, mas nao na venda individual).

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/webhook-pagamento/index.ts` | Extrair breakdown financeiro de cada plataforma e salvar em `data` da venda |
| `src/pages/Leads.tsx` | Exibir tabela de tarifas/comissoes na secao "Dados de Compra" |

## Ordem

1. Webhook: extrair financeiro por plataforma
2. Webhook: salvar em vendas.data
3. Front: renderizar breakdown quando disponivel


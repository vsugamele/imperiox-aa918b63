

# Plano: Fix Receita Duplicada + Separar OrderBump

## Problema

A Arilsiane e a Lucilene mostram `total_gasto = R$94` mas cada uma tem **apenas 1 venda de R$47**. O webhook foi chamado duas vezes pela Ticto, e o codigo atual **incrementa** `total_gasto` a cada chamada sem verificar se ja inseriu a venda. Na segunda chamada, o insert em `imphq_vendas` falha (ou cria duplicata), mas o `total_gasto` ja foi somado novamente.

## Fix 1: Recalcular total_gasto a partir das vendas reais (webhook-pagamento)

Em vez de incrementar (`currentTotal + valor`), recalcular sempre a partir de `SUM(valor)` das vendas aprovadas:

```typescript
// ANTES (linha 329):
const newTotal = (parseFloat(String(currentLead?.total_gasto)) || 0) + valor;

// DEPOIS:
const { data: salesSum } = await supabase
  .from("imphq_vendas")
  .select("valor")
  .eq("lead_id", leadId)
  .eq("status", "aprovado");
const newTotal = (salesSum || []).reduce((s, v) => s + parseFloat(String(v.valor) || "0"), 0);
```

Isso elimina o problema de duplicacao — mesmo que o webhook seja chamado 10 vezes, o total sera sempre correto.

## Fix 2: Deduplicar vendas no webhook

Antes de inserir em `imphq_vendas`, verificar se ja existe uma venda com mesmo `lead_id + produto_nome + valor` nos ultimos 5 minutos:

```typescript
const { data: existingDup } = await supabase
  .from("imphq_vendas")
  .select("id")
  .eq("lead_id", leadId)
  .eq("produto_nome", produto)
  .eq("valor", valor)
  .gte("created_at", new Date(Date.now() - 5 * 60000).toISOString())
  .limit(1);

if (existingDup && existingDup.length > 0) {
  console.log("[webhook-pagamento] Venda duplicada ignorada");
} else {
  // insert...
}
```

## Fix 3: Corrigir dados atuais

Migracao SQL (via insert tool) para recalcular `total_gasto` de todos os leads a partir das vendas reais:

```sql
UPDATE imphq_leads SET total_gasto = COALESCE((
  SELECT SUM(valor) FROM imphq_vendas 
  WHERE imphq_vendas.lead_id = imphq_leads.id AND status = 'aprovado'
), 0)
WHERE total_gasto > 0;
```

## Fix 4: Mostrar orderbump separado na tabela de Leads

Na coluna Produto (`Leads.tsx` linha 1016), agrupar por `tipo_venda`:

- Produto principal: nome normal
- OrderBump: badge "OB" ao lado
- Upsell: badge "UP" ao lado

Na coluna Receita (linha 1020), mostrar breakdown se houver multiplos tipos.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/webhook-pagamento/index.ts` | Deduplicar venda + recalcular total_gasto via SUM |
| `src/pages/Leads.tsx` | Mostrar tipo_venda (OB/UP) na coluna Produto |
| Dados SQL | Corrigir total_gasto dos leads existentes |

## Ordem

1. Fix webhook (deduplica + recalcula)
2. Deploy edge function
3. Corrigir dados via insert tool
4. UI: badges de tipo_venda na tabela


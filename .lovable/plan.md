

# Diagnostico: 3 Bugs no webhook-pagamento

## Dados encontrados no banco

| Lead | Webhooks recebidos | Vendas | Eventos Jornada | total_gasto | data.interacoes |
|---|---|---|---|---|---|
| **Fernanda** (00b1ad95) | `pix_created` + `compra_aprovada` | **0** | **0** | **0** | 1 (compra_aprovada) |
| **Ingride** (f4b426f2) | `pix_created` | **0** | **0** | **0** | **0** (vazio) |

## 3 Bugs identificados

### Bug 1: `imphq_events` — insert falha por falta de `id`

A tabela `imphq_events` tem `id text NOT NULL` sem default. O codigo do webhook (linha 389-396) **nao seta `id`** no insert. Resultado: TODAS as insercoes de eventos de jornada falham silenciosamente. Isso explica:
- Fernanda sem eventos de jornada (pix + compra)
- Ingride sem evento de jornada (pix)

**Fix**: Adicionar `id: crypto.randomUUID()` no eventInsert.

### Bug 2: `total_gasto` nunca e atualizado

Apos inserir a venda (linha 304-321), o codigo so atualiza `status: "cliente"` (linha 323-326). **Nao soma o valor em `total_gasto`**. Por isso Fernanda mostra `total_gasto = 0` e a coluna "Receita" no CRM aparece como "—".

**Fix**: Adicionar update de `total_gasto` acumulando o valor da venda.

### Bug 3: Ingride — `data.interacoes` vazio

O webhook da Ingride (`pix_created` em 12:45) nao salvou interacoes. Isso sugere que a versao deployada da edge function nao tinha a logica de interacoes ou que o mapeamento `pix_created → pix_gerado` nao estava deployado.

**Fix**: Garantir o deploy com o codigo atual + corrigir os dados manualmente.

## Solucao

### 1. Corrigir `webhook-pagamento/index.ts`

**Evento insert — adicionar id** (linha ~389):
```typescript
const eventInsert: any = {
  id: crypto.randomUUID(),  // ← ADICIONAR
  event_name: journeyEventName,
  ...
};
```

**total_gasto — acumular apos venda** (apos linha 326):
```typescript
// Acumular total_gasto
const { data: currentLead } = await supabase
  .from("imphq_leads")
  .select("total_gasto")
  .eq("id", leadId)
  .single();
const newTotal = (parseFloat(String(currentLead?.total_gasto)) || 0) + valor;
await supabase
  .from("imphq_leads")
  .update({ status: "cliente", total_gasto: newTotal })
  .eq("id", leadId);
```

### 2. Redeploy da edge function

Apos as correcoes, redeploy do `webhook-pagamento`.

### 3. Corrigir dados existentes (SQL)

Inserir a venda e eventos que faltam para Fernanda e Ingride, e atualizar `total_gasto`:

- **Fernanda**: Insert em `imphq_vendas` (R$47, Codigo dos Cortes Perfeitos) + insert em `imphq_events` (PixGerado + CompraAprovada) + update `total_gasto = 47`
- **Ingride**: Insert em `imphq_events` (PixGerado) + update do `data.interacoes` com o evento de pix

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/webhook-pagamento/index.ts` | Adicionar `id` no event insert + acumular `total_gasto` apos venda |
| Migracao SQL | Corrigir dados Fernanda + Ingride |


# Diagnóstico

## 1) Coluna "Pagamento" às vezes vazia (`LeadsTable.tsx`)

Hoje (linha 94):
```ts
const pgto = vendas.find((v: any) => v.data?.metodo_pagamento)?.data?.metodo_pagamento;
```

Problemas confirmados via DB:
- **155 vendas com `data.metodo_pagamento = NULL`** (Hotmart 25, Ticto 78, etc).
- Webhook nem sempre preenche o campo dentro do JSONB `data`.
- Mesmo quando outra venda do lead tem o método, a UI não tenta variantes (`payment_type`, `forma_pagamento`, `payment_method`).

## 2) Gráfico "Leads vs Ads vs Receita" (`src/pages/Leads.tsx` linha 433)

Bugs:
- **Ordenação incorreta**: usa `a.day.localeCompare(b.day)` em strings `"dd/MM"` — quebra na virada de mês (ex: `31/03` vai pro fim em vez de antes de `01/04`).
- **Buracos no eixo X**: dias sem lead/ad/venda são omitidos, distorcendo a curva e fazendo a área de Receita parecer "achatada" mesmo quando há ads no dia.
- **Receita zero invisível**: dias com ads mas sem venda aparecem com `revenue: undefined` em vez de `0`, gerando o efeito visto no print (linha vermelha alta, verde apagada).

# Correções

## A) `src/components/leads/LeadsTable.tsx`
Substituir a linha 94 por uma busca robusta:
```ts
const pgto = vendas
  .map((v: any) => v.data?.metodo_pagamento ?? v.data?.payment_method ?? v.data?.payment_type ?? v.data?.forma_pagamento)
  .find((m: any) => m && String(m).trim().length > 0);
```
Mostra `—` apenas quando nenhuma venda do lead tem método em nenhum dos campos conhecidos.

## B) `src/pages/Leads.tsx` — `leadsVsAds` (linha 433)
Reescrever para:
1. Calcular `start`/`end` do `periodRange` e iterar **dia a dia** com `eachDayOfInterval`, criando entrada `{ leads:0, ads:0, revenue:0 }` para cada dia (preenche buracos).
2. Indexar leads/ads/vendas por `yyyy-MM-dd` (chave estável e ordenável), só formatar para `dd/MM` no output final.
3. Ordenar pela chave `yyyy-MM-dd` (cronológica correta entre meses).
4. Garantir que `revenue` e `ads` sejam sempre números (nunca undefined).

# Resultado esperado
- Coluna Pagamento aparece sempre que **qualquer** venda do lead tiver método registrado.
- Gráfico vira uma série diária contínua, ordenada cronologicamente, com receita visível mesmo em dias de ads sem venda (mostra `0`, não some).

Arquivos editados: `src/components/leads/LeadsTable.tsx`, `src/pages/Leads.tsx`.
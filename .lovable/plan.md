

# Diagnostico: 4 Problemas Encontrados

## Investigacao no Banco

Verifiquei os dados da Fernanda de Olveira (`00b1ad95`) diretamente no Supabase:

- **Lead**: `status=cliente`, `ultimo_evento=compra_aprovada`, `total_gasto=0`
- **Webhooks recebidos**: 2 — `pix_created` (22:37) e `compra_aprovada` (22:40) — ambos da Ticto
- **imphq_vendas**: **0 registros** para este lead_id
- **imphq_events**: **0 registros** apos 22:30

A lead foi atualizada para "cliente" e `data.interacoes` tem a compra, mas a venda e os eventos nao foram criados.

---

## Bug 1: Venda nao criada (Fernanda nao aparece na Receita)

O webhook processou `compra_aprovada`, atualizou o lead para `cliente` e gravou a interacao em `data.interacoes`. Porem **nao inseriu na `imphq_vendas`**.

**Causa**: O campo `tipo_venda` foi adicionado ao codigo do webhook mas a coluna pode nao existir na tabela (a migracao anterior adicionou `imphq_lead_scores_log` e `imphq_push_subscriptions`, mas a migracao de `tipo_venda` em `imphq_vendas` pode ter falhado ou nao sido executada). O insert falha silenciosamente.

Tambem: `total_gasto` nao esta sendo atualizado no lead apos a compra.

**Fix**:
- Verificar/criar coluna `tipo_venda` em `imphq_vendas` via migracao
- No webhook: adicionar error handling no insert de vendas e atualizar `total_gasto` no lead
- Remover `tipo_venda` do insert se a coluna nao existir (usar `data` JSONB como fallback)

## Bug 2: Pix Gerado nao aparece na Jornada

O Ticto envia `status: "pix_created"` mas o `statusMap` (linha 80 do webhook) nao tem essa entrada. Resultado: `evento = "pix_created"` que nao esta no `JOURNEY_EVENT_MAP`, entao nenhum evento e criado em `imphq_events`.

**Fix**: Adicionar ao webhook:
- `statusMap`: `pix_created: "pix_gerado"`
- `JOURNEY_EVENT_MAP` ja tem `pix_gerado: "PixGerado"` — vai funcionar automaticamente

## Bug 3: Eventos nao criados (ambos — pix e compra)

Mesmo o `compra_aprovada` que deveria gerar um evento `CompraAprovada` via `JOURNEY_EVENT_MAP` nao gerou nenhum registro em `imphq_events`. Isso confirma que o insert esta falhando silenciosamente — provavelmente pelo mesmo problema de schema ou porque a edge function deployada e uma versao antiga.

**Fix**: Adicionar try/catch com log nos inserts de eventos + redeployar a edge function

## Bug 4: Filtros do Financas nao atualizam tabelas

No `Financas.tsx`, os filtros (projeto, data) geram `fVendas`, `fAds`, `fProjectCosts` que sao passados aos KPIs e ao Overview. Porem os componentes de tabs (FinancasAds, FinancasProdutos, FinancasPerformance) recebem dados ja filtrados via props — entao o filtro DEVERIA funcionar.

O problema e que `FinancasAds` recebe `ads` (filtrado `fAds`) mas quando o usuario muda filtro de data, a tabela de Ads usa `ads` direto que ja vem filtrado. O que pode estar acontecendo e que a tabela interna faz paginacao (`page`) que nao reseta quando o filtro muda.

**Fix**: Resetar `page` para 0 quando `ads` (props) mudar em `FinancasAds`

---

## Plano de Execucao

### 1. Migracao SQL
- `ALTER TABLE imphq_vendas ADD COLUMN IF NOT EXISTS tipo_venda TEXT DEFAULT 'principal'`

### 2. `webhook-pagamento/index.ts`
- Adicionar `pix_created: "pix_gerado"` ao `statusMap` do Ticto v2
- Adicionar error handling nos inserts de vendas e eventos (log do erro)
- Atualizar `total_gasto` no lead apos insert de venda aprovada
- Scoring para pix_gerado (+15 pontos)

### 3. `FinancasAds.tsx`
- Adicionar `useEffect` que reseta `page` para 0 quando `ads.length` mudar

### 4. Corrigir dados da Fernanda (insert manual)
- Inserir a venda que faltou em `imphq_vendas` e atualizar `total_gasto`

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | `tipo_venda` column em imphq_vendas |
| `supabase/functions/webhook-pagamento/index.ts` | pix_created mapping, error handling, total_gasto update |
| `src/components/financas/FinancasAds.tsx` | Reset paginacao ao mudar filtros |
| Insert SQL | Corrigir dados Fernanda (venda + total_gasto) |


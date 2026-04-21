

## Plano: corrigir contagem "Vendas" + tornar dashboard navegável

### 1. Por que aparece 3 vendas hoje em vez de 2

Conferi `imphq_vendas`. Hoje (21/04) há **3 registros aprovados** com `data_venda = hoje`:

| Produto | Plataforma | Tipo | Valor | created_at original |
|---|---|---|---|---|
| Código dos Cortes Perfeitos | Ticto | principal | R$ 47,00 | 21/04 |
| A Arte da Cobertura de Tatuagem | Hotmart | upsell | R$ 49,90 | **14/04** |
| A Arte da Cobertura de Tatuagem | Hotmart | upsell | R$ 49,90 | **13/04** |

O sistema está contando certo do ponto de vista do banco — são 3 linhas com `data_venda` hoje. O problema é que **upsells antigos tiveram `data_venda` reescrita para a data do reprocessamento do webhook**, inflando a contagem do dia.

**Causa**: em `webhook-pagamento`, ao receber um update de status (PIX virando aprovado, ou retry da plataforma), o campo `data_venda` está sendo setado para `now()` em vez de preservar a data original da transação. Vou verificar e corrigir para usar a data efetiva do pagamento que vem no payload (Hotmart manda `purchase.approved_date` / Ticto manda `paid_at`).

**Correção**:
- Em `supabase/functions/webhook-pagamento/index.ts`, ao fazer upsert/update, manter `data_venda` = data de aprovação do payload. Se já existir registro, **não sobrescrever** `data_venda` no update (só atualiza status/valor).
- Métrica "Vendas" do `DashboardStats` passa a separar **Principal vs Upsell** opcional via tooltip, pra deixar claro o mix.
- Bônus: filtrar `tipo_venda = 'principal'` no card "Vendas" (e mostrar upsells em sublinha "+N upsells"), evitando confusão semelhante no futuro.

### 2. Cards e seções clicáveis com drill-down

Hoje os cards do dashboard são `cursor-default`. Vou tornar os principais navegáveis abrindo um **painel lateral (Sheet)** com o detalhamento da métrica:

**Cards interativos no `DashboardStats`:**
- **Receita** → lista das vendas do período (produto, valor, plataforma, data, lead)
- **Lucro** → breakdown receita − ads − operacional
- **ROAS Real** → tabela de campanhas com gasto + receita atribuída + ROAS individual
- **Custo Total** → split Ads/Operacional com origem (campanha / categoria)
- **Vendas** → lista detalhada (mesma da Receita, agrupada por produto)
- **Leads** → top leads recentes com link pro CRM
- **Tarefas Pend.** → link direto pra `/tarefas`
- **Projetos** → link pra `/projetos`

**No `DashboardAds` (Investimento em Ads):**
- Cada KPI (CPA, ROAS Real, Investido, etc.) abre um Sheet com a **lista de campanhas** que compõem aquele número, ordenada por contribuição.
- Linhas de campanha já existentes ganham clique → expandem mostrando: adsets, criativos, gasto diário (sparkline), vendas atribuídas via UTM, CTR/CPC histórico.

**Componente novo**: `DashboardDrillSheet.tsx` — um Sheet reutilizável que recebe `metric`, `period`, `projectFilter`, `productFilter` e renderiza a tabela apropriada. Evita duplicar Sheets em cada componente.

### Arquivos afetados
- `supabase/functions/webhook-pagamento/index.ts` — preservar `data_venda` original
- `src/components/dashboard/DashboardStats.tsx` — cards clicáveis + sheet
- `src/components/dashboard/DashboardAds.tsx` — KPIs e linhas de campanha clicáveis
- `src/components/dashboard/DashboardDrillSheet.tsx` — **novo**, sheet de drill-down

### Fora de escopo
- Migration retroativa pra corrigir `data_venda` dos 2 upsells antigos (posso fazer numa próxima se quiser — preciso confirmar a data correta de cada um).
- Drill-down do Funil de Conversão e Leads Quentes (já têm navegação parcial).


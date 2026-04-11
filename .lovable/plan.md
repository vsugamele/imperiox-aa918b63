

# Fix: Aba Comando — KPIs e dados incorretos

## Problemas identificados

Analisando o código de `ProjetoComando.tsx` e comparando com o screenshot:

1. **KPIs "Pix Gerados" e "Vendas Hoje" sempre zero** — Buscam de `imphq_events` (tabela de analytics/pixel) filtrando `event_name === "pix_created"`. Mas os dados de vendas reais estão em `imphq_vendas`. Resultado: sempre 0.

2. **"Leads Hoje" sempre zero** — Filtra `created_at` com `startsWith(today)` usando hora UTC, que pode não bater com horário BR. Além disso, leads podem estar entrando mas o filtro de data não captura.

3. **"Eventos Hoje"** — Busca de `imphq_events` (analytics). Deveria ser `imphq_calendar_events` para mostrar compromissos do dia.

4. **"Pendentes" conta leads com status "pend/carrinho/pix"** — Deveria contar vendas pendentes (que já aparecem no breakdown de produtos), não leads.

## Solução

Reescrever as queries e KPIs do `ProjetoComando.tsx`:

| KPI | De (errado) | Para (correto) |
|-----|-------------|-----------------|
| Pix Gerados | `imphq_events` (pix_created) | `imphq_vendas` where status in (pendente, pix, waiting) criadas hoje |
| Vendas Hoje | `imphq_events` (approved) | `imphq_vendas` where status = aprovado criadas hoje |
| Leads Hoje | leads com created_at.startsWith(today) | Usar filtro `.gte()` e `.lt()` com range do dia em UTC-3 |
| Pendentes | leads com status pend/carrinho | `imphq_vendas` where status != aprovado (count) |
| Eventos Hoje | `imphq_events` (analytics) | `imphq_calendar_events` com start_date de hoje |

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/projeto/ProjetoComando.tsx` | Corrigir queries (vendas em vez de events), ajustar KPIs, usar calendar_events |


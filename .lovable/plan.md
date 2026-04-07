

# Plano: Mostrar produto nos leads com Pix gerado / pendentes

## Problema

No ProjetoComando, os KPIs "Pix Gerados" e "Pendentes" mostram apenas contagem. Na tabela de "Ultimos Leads", o status aparece como badge mas sem informacao de qual produto gerou o pix ou carrinho.

## Fonte dos dados de produto

- **`imphq_leads.data`** (JSONB): contem `interacoes[]` com `{ evento, produto, ... }` e `ultimo_evento` — preenchido pelo webhook-pagamento
- **`imphq_vendas`**: tem `produto_nome`, `status` e `lead_id` — vendas pendentes/aprovadas por lead
- **`imphq_events.event_data`** (JSONB): contem `{ produto, valor, plataforma }` para eventos de jornada

## Solucao

### 1. Buscar vendas pendentes do projeto

Adicionar uma query ao `load()` do ProjetoComando para buscar `imphq_vendas` com status diferente de "aprovado" (pendentes, pix, carrinho) do projeto hoje. Isso traz `produto_nome` e `lead_id`.

### 2. KPI "Pix Gerados" expandido

Abaixo do card KPI de "Pix Gerados", adicionar uma mini-lista mostrando os produtos com pix pendente e a quantidade de cada um. Ex:
```
Pix Gerados: 3
  Curso X — 2
  Mentoria Y — 1
```

### 3. Coluna "Produto" na tabela de Leads

Adicionar uma coluna "Produto" na tabela de ultimos leads. Para cada lead, buscar o produto de:
1. Vendas pendentes associadas ao lead (`imphq_vendas` onde `lead_id` = lead.id)
2. Fallback: `lead.data?.interacoes` — ultimo evento com produto

### 4. Badge de produto nos "Pendentes"

Para leads pendentes, mostrar o nome do produto como badge extra ao lado do status.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/ProjetoComando.tsx` | Nova query vendas pendentes, coluna Produto na tabela, breakdown de produtos no KPI Pix |

## Detalhes tecnicos

- Query adicional: `supabase.from("imphq_vendas").select("lead_id, produto_nome, status, valor").eq("project_id", projectId).neq("status", "aprovado")`
- Criar `Map<lead_id, produto_nome>` para lookup rapido na tabela de leads
- Para o breakdown do KPI, agrupar vendas pendentes por `produto_nome` e mostrar contagem
- Tambem buscar vendas de hoje (aprovadas ou nao) para enriquecer o KPI de Pix com o nome do produto


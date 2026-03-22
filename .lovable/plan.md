

# Plano: Sistema Financeiro Completo com Visao Consolidada + Ads

## Situacao Atual

- **`/financas`** (`Financas.tsx`): Apenas custos de ferramentas globais (`imphq_custos`) — sem vinculo a projetos, sem receitas, sem ads.
- **`ProjetoFinancas.tsx`**: Custos e receitas por projeto (`imphq_project_costs`, `imphq_project_revenue`) — funciona isoladamente dentro de cada projeto.
- **`imphq_vendas`**: Vendas reais recebidas via webhook, com `project_id`, `valor`, UTMs, plataforma — dados ricos ja existem mas nao sao usados em Financas.

## O que vamos construir

Transformar `/financas` em um **dashboard financeiro consolidado** que:

1. Agrega custos de TODOS os projetos + custos globais (ferramentas)
2. Agrega receitas/vendas de todos os projetos (de `imphq_vendas` + `imphq_project_revenue`)
3. Permite importar/cadastrar gastos de Facebook Ads (via CSV upload ou manual)
4. Mostra dados ricos: ROI por projeto, custo vs receita, breakdown por categoria
5. Permite filtrar por projeto

## Alteracoes

### 1. Nova tabela: `imphq_ads_spend`

Para registrar gastos de ads (Facebook, Google, etc.) por projeto e por dia:

```sql
CREATE TABLE imphq_ads_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES imphq_projects(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL DEFAULT 'Facebook',
  campanha TEXT,
  data_ref DATE NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  impressoes INT DEFAULT 0,
  cliques INT DEFAULT 0,
  leads INT DEFAULT 0,
  moeda TEXT DEFAULT 'BRL',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_ads_spend ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_spend_all" ON imphq_ads_spend FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. Reescrever `src/pages/Financas.tsx`

Novo layout com tabs e filtro por projeto:

```text
┌─────────────────────────────────────────────────────────┐
│  💰 Finanças          [Filtro: Todos os Projetos ▼]     │
├─────────────────────────────────────────────────────────┤
│  KPIs: Receita Total | Custo Total | Lucro | ROI | CPA │
├─────────────────────────────────────────────────────────┤
│  [Visao Geral] [Custos] [Receitas] [Ads] [Por Projeto] │
├─────────────────────────────────────────────────────────┤
│  Tab Visao Geral:                                       │
│    - Grafico barras: Receita vs Custo por projeto       │
│    - Tabela resumo por projeto (custo, receita, lucro)  │
│                                                         │
│  Tab Custos:                                            │
│    - Custos globais (imphq_custos) + por projeto        │
│    - Agrupados por categoria                            │
│                                                         │
│  Tab Receitas:                                          │
│    - Vendas de imphq_vendas + imphq_project_revenue     │
│    - Por plataforma, por produto                        │
│                                                         │
│  Tab Ads:                                               │
│    - CRUD de gastos de ads (imphq_ads_spend)            │
│    - Upload CSV do Facebook Ads                         │
│    - Metricas: CPC, CPL, ROAS                          │
│                                                         │
│  Tab Por Projeto:                                       │
│    - Cards por projeto com mini P&L                     │
└─────────────────────────────────────────────────────────┘
```

**Dados agregados de:**
- `imphq_custos` — custos globais de ferramentas
- `imphq_project_costs` — custos por projeto
- `imphq_vendas` — vendas reais (webhook)
- `imphq_project_revenue` — receitas manuais por projeto
- `imphq_ads_spend` — gastos de ads (novo)
- `imphq_projects` — nomes/icones dos projetos

**KPIs calculados:**
- Receita Total (vendas + receitas manuais)
- Custo Total (ferramentas + custos projeto + ads)
- Lucro (receita - custo)
- ROI% ((lucro / custo) * 100)
- CPA (custo ads / numero de vendas)
- ROAS (receita / custo ads)

### 3. Componente `src/components/financas/AdsImportDialog.tsx`

Dialog para importar CSV do Facebook Ads:
- Aceita CSV com colunas: `campanha, data, valor, impressoes, cliques`
- Parseia e insere em `imphq_ads_spend`
- Preview dos dados antes de importar

### 4. Componente `src/components/financas/FinancasOverview.tsx`

Tab de visao geral com:
- Grafico de barras horizontal (Recharts) — Receita vs Custo por projeto
- Tabela resumo consolidada por projeto

### 5. Componente `src/components/financas/FinancasAds.tsx`

Tab de Ads com:
- Tabela de gastos de ads
- CRUD manual + import CSV
- Metricas derivadas (CPC, CPL, ROAS)

## Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | **Nova tabela** `imphq_ads_spend` |
| `src/pages/Financas.tsx` | Reescrever completo — dashboard consolidado com tabs |
| `src/components/financas/AdsImportDialog.tsx` | **Novo** — Import CSV de ads |
| `src/components/financas/FinancasOverview.tsx` | **Novo** — Visao geral com graficos |
| `src/components/financas/FinancasAds.tsx` | **Novo** — Tab de gestao de ads |


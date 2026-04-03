

# Plano: BMs/Ad Accounts Manager + Salvar Análise de Performance + Melhorias Ads

---

## 1. Gerenciador de BMs e Contas de Anúncios

Criar uma tabela `imphq_ad_accounts` para organizar Business Managers e contas de anúncio (como na planilha da imagem: BM ID, Ad Account ID, Nome).

### Tabela SQL

```sql
create table public.imphq_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  bm_id text not null,
  ad_account_id text not null,
  nome text not null,
  plataforma text default 'Facebook',
  status text default 'ativo',
  notas text,
  created_at timestamptz default now()
);
alter table public.imphq_ad_accounts enable row level security;
create policy "Users manage own ad accounts" on public.imphq_ad_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### UI: Nova aba em Empresa.tsx

Adicionar uma aba "Ad Accounts" na página Empresa (`src/pages/Empresa.tsx`) com:
- Tabela listando BM ID, Ad Account ID, Nome, Status
- Botão de adicionar/editar/remover
- Badge de status (Ativo, Pausado, Banido)
- Poder vincular uma conta ao projeto no momento da configuração do Facebook

---

## 2. Salvar Análise de Performance no Banco

Atualmente a análise de performance gerada por IA (`handleAnalyzePerformance`) só aparece em um Dialog temporário. O usuário quer salvar e o time visualizar.

### Tabela SQL

```sql
create table public.imphq_ads_reports (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  titulo text not null default 'Análise de Performance',
  report_data jsonb not null,
  model_used text,
  period_start date,
  period_end date,
  created_at timestamptz default now()
);
alter table public.imphq_ads_reports enable row level security;
create policy "Auth users manage reports" on public.imphq_ads_reports
  for all to authenticated using (true) with check (true);
```

### UI: Salvar + Histórico

No `ProjetoFinancas.tsx`:
- No Dialog de Análise, adicionar botão **"Salvar Relatório"** que persiste `adsAnalysis` na tabela `imphq_ads_reports`
- Nova sub-aba **"Relatórios"** dentro de Ads, listando relatórios salvos com data e botão para abrir/visualizar
- Cada relatório abre no mesmo layout formatado do Dialog (com resumo, melhor/pior campanha, alertas, otimizações)

---

## 3. Melhorias na aba Ads/Criativos

### 3.1 Criativos com métricas
Atualmente os criativos mostram apenas thumbnail, nome, body e status. Melhorar para incluir:
- Métricas do criativo (impressões, cliques, CTR, gastos) cruzando com dados de `imphq_ads_spend` pelo nome do anúncio
- Badge de performance (Top, Médio, Baixo) baseado no CTR
- Filtro por status (ACTIVE, PAUSED, etc.)

### 3.2 Agrupamento por Conjunto de Anúncios
Na tabela de dados de Ads, agrupar por `conjunto_anuncios` com totais por grupo, permitindo expandir para ver as campanhas individuais.

### 3.3 KPIs de Ads melhorados
Adicionar cards de:
- Frequência Média
- Alcance Total
- Custo por Compra médio
- CPM (custo por mil impressões)

---

## Resumo de arquivos

| Arquivo | Mudanca |
|---|---|
| **Migração SQL** | Tabelas `imphq_ad_accounts` e `imphq_ads_reports` |
| `src/pages/Empresa.tsx` | Nova aba "Ad Accounts" com CRUD de BMs e contas |
| `src/components/projeto/ProjetoFinancas.tsx` | Botão salvar análise, sub-aba Relatórios, melhorias criativos e KPIs |

---

## Ordem de execução

1. Migração SQL (2 tabelas)
2. Aba Ad Accounts na Empresa
3. Salvar + listar relatórios de performance
4. Melhorias visuais em Ads/Criativos


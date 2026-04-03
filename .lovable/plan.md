

# Plano: Completar Melhorias Ads + Criativos + Dashboard

---

## Parte 1 — Completar pendências do ProjetoFinancas (Ads)

### 1.1 Botão "Salvar Relatório" no Dialog de Análise

O `saveReport()` já existe mas o botão **nao aparece** no Dialog de análise. Adicionar botão "Salvar Relatório" no `DialogFooter` do dialog de análise de performance (onde `showAnalysis` é true).

### 1.2 Dialog para visualizar relatório salvo

Quando o user clica "Ver" em um relatório salvo, `viewingReport` é setado mas **nao existe Dialog** para exibi-lo. Criar um Dialog que renderiza `viewingReport.report_data` no mesmo formato da análise (resumo, melhor/pior campanha, alertas, otimizações).

### 1.3 KPIs extras na aba Dados

Adicionar segunda linha de KPI cards:
- **CPM** (custo por mil impressões): `(totalAds / totalImpressions) * 1000`
- **Frequência Média**: média de `frequencia` dos registros
- **Alcance Total**: soma de `alcance`
- **Custo por Compra**: `totalAds / totalCompras`

### 1.4 Criativos com métricas reais

Cruzar criativos (`project.data.facebook_creatives`) com dados de `fAds` pelo nome do anúncio:
- Mostrar Impressões, Cliques, Gasto e CTR em cada card de criativo
- Badge de performance: **Top** (CTR > 2%), **Médio** (1-2%), **Baixo** (< 1%)
- Filtro de status (ACTIVE/PAUSED)

### 1.5 Agrupamento por Conjunto de Anúncios

Na tabela de Dados, agrupar rows por `conjunto_anuncios` com:
- Accordion/collapsible com subtotais (gasto, impressões, cliques, compras)
- Expandir para ver anúncios individuais

---

## Parte 2 — Melhorias no Dashboard

### 2.1 Seção Ads consolidada

Adicionar card **"Performance de Ads"** ao dashboard com KPIs globais (todos os projetos):
- Gasto Total em Ads (30d)
- CPL Médio
- ROAS Global
- Total de Compras

Dados da tabela `imphq_ads_spend` filtrados pelos últimos 30 dias.

### 2.2 Gasto em Ads por Projeto (gráfico)

Novo gráfico de barras horizontais mostrando gasto em ads por projeto (Top 5), similar ao "Receita por Projeto" que já existe.

### 2.3 Top Campanhas

Card listando as 5 campanhas com maior gasto nos últimos 30 dias, com CTR e compras ao lado.

### 2.4 Alerta de Frequência Alta

Adicionar alerta inteligente: se alguma campanha tem frequência > 3.0 nos últimos 7 dias, avisar "⚠ Campanha X com frequência alta (X.X) — risco de saturação".

### 2.5 Filtro de período global no Dashboard

Atualmente o dashboard mostra dados fixos (30d leads, 6m receita). Adicionar um Select com períodos (7d, 30d, 90d, 6m) que filtra **todos** os gráficos e KPIs do dashboard.

---

## Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/projeto/ProjetoFinancas.tsx` | Botão salvar no dialog, dialog visualizar relatório, KPIs extras (CPM/Freq/Alcance/CPA), criativos com métricas, agrupamento por conjunto |
| `src/pages/Dashboard.tsx` | Seção Ads global, gasto por projeto, top campanhas, alerta frequência, filtro período global |

---

## Ordem de execução

1. ProjetoFinancas: botão salvar + dialog visualizar relatório
2. ProjetoFinancas: KPIs extras + criativos com métricas + agrupamento
3. Dashboard: seção Ads + gráficos + alertas + filtro global




# Plano: Dashboard Financeiro Inteligente com Cruzamento Ads x Vendas por Produto

## Contexto

Voce tem dois CSVs:
- **Facebook Ads** (PT-BR): colunas como "Nome da campanha", "Valor usado (BRL)", "Impressões", "Compras", "Hook Rate", etc.
- **Vendas Ticto** (425 linhas): multiplos produtos do JP ("Codigo dos Cortes Perfeitos", "Segredo do Corte", etc.) com UTMs do Facebook

O importador de Ads atual nao mapeia as colunas em portugues do Facebook. E o dashboard nao cruza ads com vendas por produto.

## Alteracoes

### 1. Expandir tabela `imphq_ads_spend` (migration)

Adicionar colunas ricas do Facebook Ads:

```sql
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS alcance INT DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS resultados INT DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS custo_por_resultado NUMERIC(10,2) DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS compras INT DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS custo_por_compra NUMERIC(10,2) DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS conjunto_anuncios TEXT;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS anuncio TEXT;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS hook_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS hold_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS ctr NUMERIC(5,2) DEFAULT 0;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS frequencia NUMERIC(5,2) DEFAULT 0;
```

### 2. Reescrever `AdsImportDialog.tsx`

Mapear todas as colunas PT-BR do Facebook Ads:
- "Nome da campanha" -> campanha
- "Nome do conjunto de anuncios" -> conjunto_anuncios
- "Valor usado (BRL)" -> valor (parse "R$1.234,56" -> 1234.56)
- "Impressoes" -> impressoes
- "Alcance" -> alcance
- "Compras" -> compras
- "Hook Rate" / "Hold Rate" / "CTR" -> campos numericos
- "Inicio dos relatorios" / "Termino dos relatorios" -> data_ref

Preview com mais colunas e feedback de quantas linhas validas.

### 3. Importar vendas Ticto via LeadImportDialog (ja existe)

O CSV de vendas ja e suportado pelo LeadImportDialog existente. Basta importar associando ao projeto JP. As vendas entram em `imphq_vendas` com `produto_nome` separado.

### 4. Nova tab "Por Produto" no dashboard Financas

Novo componente `FinancasProdutos.tsx`:
- Agrupa vendas de `imphq_vendas` por `produto_nome`
- Mostra por produto: qtd vendas, receita total, ticket medio
- Tabela com ranking de produtos por faturamento
- Grafico de pizza/barras com distribuicao de receita por produto

### 5. Melhorar `FinancasOverview.tsx` com cruzamento

- Adicionar secao "Ads vs Vendas" com timeline (Recharts AreaChart):
  - Eixo X: datas
  - Linha 1: gasto ads diario (de `imphq_ads_spend`)
  - Linha 2: receita vendas diaria (de `imphq_vendas`)
- Card de ROAS real: receita total vendas / gasto total ads
- Card de CPA real: gasto ads / numero de vendas aprovadas

### 6. Melhorar tab Ads com metricas ricas

Mostrar as novas colunas na tabela: Alcance, Hook Rate, CTR, Compras, Custo/Compra. Adicionar KPIs de CTR medio e Hook Rate medio.

## Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Expandir `imphq_ads_spend` com colunas ricas |
| `src/components/financas/AdsImportDialog.tsx` | Reescrever mapeamento para colunas PT-BR do Facebook |
| `src/components/financas/FinancasProdutos.tsx` | **Novo** - breakdown por produto |
| `src/components/financas/FinancasOverview.tsx` | Adicionar timeline ads vs vendas e ROAS real |
| `src/components/financas/FinancasAds.tsx` | Exibir colunas ricas (alcance, hook rate, CTR) |
| `src/pages/Financas.tsx` | Adicionar tab "Produtos", passar vendas ao overview |


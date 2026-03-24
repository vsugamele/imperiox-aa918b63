

# Plano: Corrigir Importacao de Leads Ticto + Melhorar Importacao de Ads

## Problemas identificados

### 1. Leads Ticto - dados nao chegam
O CSV da Ticto usa encoding **Latin-1** (caracteres como `�` no preview). O Papa.parse usa UTF-8 por default, entao colunas com acentos ("Método de Pagamento", "Código do Pedido", "Nome do Produto") nao sao encontradas pelo `findCol`, resultando em campos vazios.

Alem disso, a insercao em `imphq_vendas` usa `produto` mas a coluna real e `produto_nome`. Dados de UTM (utm_source, utm_campaign, utm_content, utm_term) existem no CSV mas podem nao estar sendo mapeados corretamente por causa do encoding.

### 2. Ads Import - campos faltando do documento tecnico
O documento tecnico lista campos essenciais que o importador atual nao captura:
- **Nivel de veiculacao** (campaign/adset/ad) para filtrar agregacao
- **Finalizacoes de compra iniciadas** (checkouts) para calcular CPCk e LP->Checkout
- **Stop Rate** (calculado: Alcance/Impressoes)
- **CPM** (calculado: Investimento/Impressoes*1000)
- Hook/Hold Rate como decimais (multiplicar por 100)

## O que sera feito

### 1. Fix encoding no LeadImportDialog

- Tentar parse com `encoding: "latin-1"` como fallback quando UTF-8 produz headers com `�`
- Adicionar candidates sem acento no `findCol` para todas as colunas Ticto (ex: "Metodo de Pagamento", "Codigo do Pedido", "Numero do Pedido")
- Isso garante que produto, metodo pagamento, bandeira, parcelas, UTMs, valor liquidado etc. sejam capturados

### 2. Mapear campos faltantes da Ticto no lead import

- **Valor Liquidado**: mapear e salvar no `data` da venda (receita liquida pos-taxas)
- **Id do Produto** (`produto_id_ext`): salvar na venda
- **Plataforma de Anuncio**: mapear como dado extra de UTM
- **Conjunto de Anuncios** e **Anuncio**: salvar no data da venda para cruzamento com Meta
- Corrigir insert: `produto` -> `produto_nome`
- Salvar UTMs completos incluindo `utm_content` e `utm_term` (ja existem colunas no `imphq_vendas`)
- Detectar se lead e organico ou ads: se `utm_source` contiver "FB"/"ig" = Meta Ads, se vazio/organic = organico

### 3. Mostrar dados completos na preview da importacao

Na tabela de preview, adicionar colunas: Produto, Pagamento (Pix/Cartao+bandeira), Parcelas, UTM Source, para o usuario validar antes de importar.

### 4. Melhorar AdsImportDialog com campos do documento tecnico

- Adicionar campos: `nivel_veiculacao`, `checkouts_iniciados`, `cpm` (calculado), `stop_rate` (calculado)
- Mapear "Nivel de veiculacao" / "Level" do CSV
- Mapear "Finalizacoes de compra iniciadas" / "Checkouts" / "Purchases initiated"
- Calcular metricas derivadas pos-parse: stop_rate, cpm, lp_checkout, cpck
- Exibir na preview com badges de benchmark (do documento: Hook Rate < 15% = ruim, etc.)

### 5. Migration: novos campos em imphq_ads_spend

```sql
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS nivel_veiculacao TEXT;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS checkouts_iniciados INT;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS cpm NUMERIC;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS stop_rate NUMERIC;
ALTER TABLE imphq_ads_spend ADD COLUMN IF NOT EXISTS cpck NUMERIC;
```

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| Migration SQL | Novos campos em `imphq_ads_spend` |
| `src/components/leads/LeadImportDialog.tsx` | Fix encoding Latin-1, mapear todos os campos Ticto, corrigir `produto` -> `produto_nome`, preview completo |
| `src/components/financas/AdsImportDialog.tsx` | Novos campos (nivel, checkouts, metricas calculadas), badges de benchmark |
| `src/integrations/supabase/types.ts` | Atualizar tipos |


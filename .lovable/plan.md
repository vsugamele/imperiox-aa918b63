

# Plano: Melhorias na Aba Ads — Cruzamento de Vendas + Filtros + Galeria de Criativos

## Diagnóstico

### 1. Vendas do dia 10 não aparecem como "Compras"
A coluna "Compras" na tabela de Ads vem exclusivamente do Facebook Pixel (`actions.purchase`). Mas as vendas reais estão na tabela `imphq_vendas` (via webhook Ticto). No dia 10/04 houve 2 vendas reais (R$47 + R$37) mas o Facebook registrou 0 compras via pixel. **O sistema não cruza as duas fontes.**

### 2. Tabela de Dados sem filtros úteis
Não há filtro por campanha, conjunto de anúncios ou anúncio na tabela de dados. Só o filtro de período global.

### 3. Galeria de Criativos limitada
- Imagem cortada no aspect-video (não dá pra ver a imagem inteira)
- Sem filtro por campanha/conjunto
- Sem link para abrir a imagem em tela cheia
- Sem URL do anúncio/post

---

## Solução

### A. Cruzar vendas reais com dados de Ads (novo KPI)
Adicionar ao bloco de KPIs da aba Dados:
- **"Vendas Reais"** — count de `imphq_vendas` no período filtrado
- **"Receita Vendas"** — soma de `valor` das vendas aprovadas
- **"ROAS Real"** — receita vendas / investimento ads

Isso já existe no `fVendas` que já é carregado. Basta adicionar 3 KPIs extras usando esses dados.

### B. Filtros na tabela de Dados
Adicionar barra de filtros acima da tabela:
- **Busca por campanha** (text input)
- **Filtro por conjunto de anúncios** (select com os conjuntos existentes)
- **Filtro por anúncio** (select)

### C. Melhorias na Galeria de Criativos
- **Imagem completa**: trocar `aspect-video object-cover` por `object-contain` com max-height, permitindo ver a imagem toda
- **Lightbox**: clicar na imagem abre em modal full-size
- **Filtro por campanha/conjunto**: adicionar select de conjunto baseado nos dados de ads que fazem match com o criativo
- **URL do anúncio**: se disponível, mostrar link para abrir no Facebook

---

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/projeto/ProjetoFinancas.tsx` | KPIs de vendas reais na sub-aba Dados, filtros de campanha/conjunto/anúncio, melhorias na galeria de criativos (imagem completa, lightbox, filtro por conjunto, URL) |




# Plano: Imposto % por Produto + Passo a Passo do Facebook Token

---

## 1. Campo de % de imposto no Briefing (por produto) e no cálculo financeiro

**Onde**: No briefing do projeto, cada produto já tem `nome`, `tipo`, `preco`. Adicionar um campo `imposto_pct` (percentual de imposto, ex: 6.49 para Hotmart) no JSONB do produto.

**Briefing** (`ProjetoBriefing.tsx`):
- No grid de campos do produto (linha ~408), adicionar um 4o campo: **"% Imposto"** com Input type="number" step="0.01", placeholder "Ex: 6.49"
- Salva como `imposto_pct` no objeto do produto via `updateProduto(i, "imposto_pct", val)`

**Form de Receita** (`ProjetoFinancas.tsx`):
- No revForm, adicionar campo `imposto_pct` (default: preenche automaticamente do produto selecionado)
- Quando o usuário seleciona um produto no form, buscar o `imposto_pct` do briefingProdutos correspondente e preencher
- No resumo calculado (linhas 815-831), adicionar:
  - **Imposto**: valor × quantidade × (imposto_pct / 100)
  - **Lucro Líquido**: Receita Total - Custo Produto - Imposto
- Na tabela de receitas, adicionar coluna "Imposto" e "Líquido"

**FinancasProdutos** (`FinancasProdutos.tsx`):
- Receber `briefingProdutos` (já recebe) e pegar `imposto_pct` de cada produto
- Calcular imposto = receita × (imposto_pct / 100) por produto
- Adicionar coluna "Imposto" e ajustar "Lucro" para deduzir o imposto
- No KPI geral, mostrar "Lucro Líquido" (receita - custos - ads - impostos)

**Sem migration**: Tudo fica no JSONB do produto (briefing) e nos cálculos frontend.

**Arquivos**: `src/components/projeto/ProjetoBriefing.tsx`, `src/components/projeto/ProjetoFinancas.tsx`, `src/components/financas/FinancasProdutos.tsx`

---

## 2. Passo a passo para configurar o Facebook Token

Adicionar um Dialog/Guia acessível via botão "Como configurar?" na aba Ads e na integração do Facebook Pixel no Briefing. Conteúdo:

**Passo 1 — Criar App no Meta for Developers**
1. Acessar https://developers.facebook.com/apps/
2. Clicar em "Criar App" → tipo "Negócios"
3. Vincular ao Business Manager

**Passo 2 — Obter o Ad Account ID**
1. Acessar https://business.facebook.com/settings/ad-accounts
2. Copiar o número da conta (ex: 123456789)
3. Colar no campo "Ad Account ID" com prefixo `act_`

**Passo 3 — Gerar Access Token de longa duração**
1. No Meta for Developers → App → Tools → Graph API Explorer
2. Selecionar permissões: `ads_read`, `ads_management`, `read_insights`
3. Gerar token de curta duração
4. Trocar por token de longa duração via URL: `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}`
5. Colar o token no campo "Access Token CAPI"

**Passo 4 — Testar**
1. Clicar em "Sincronizar Facebook"
2. Verificar se os dados aparecem na aba Ads

**Implementação**: Dialog com stepper visual, texto claro e links diretos para cada página do Facebook. Botão "Como configurar?" ao lado do banner de info na aba Ads.

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx` (Dialog inline)

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Campo `imposto_pct` por produto |
| `src/components/projeto/ProjetoFinancas.tsx` | Imposto no form receita + cálculo líquido + Dialog passo a passo Facebook |
| `src/components/financas/FinancasProdutos.tsx` | Coluna imposto + lucro líquido por produto |




# Plano: Custos por Produto + Receita com Qtd/Lucro + Explicação Facebook Ads

---

## 1. Custos associados ao produto na aba Produtos e no Breakdown

**Problema**: A tabela de Produtos (`FinancasProdutos.tsx`) já recebe `costs` e cruza por `produto_nome`, mas na coluna "Custos" a maioria mostra "—" porque poucos custos têm `produto_nome` preenchido. No breakdown do `FinancasPerformance.tsx`, os cards de produto só mostram Receita, Vendas e Ticket Médio — não mostram custos nem lucro.

**Solução**:
- **FinancasProdutos**: Incluir também os custos de Ads (`imphq_ads_spend`) no cálculo por produto. Atualmente só soma `imphq_project_costs` com `produto_nome`. Adicionar uma prop `ads` e distribuir o gasto de ads proporcionalmente ou por campanha quando possível. Também adicionar uma linha de "Custos Ads" separada na tabela (além dos custos operacionais).
- **FinancasPerformance** (Breakdown por Produto): Adicionar linhas de Custos e Lucro em cada card de produto, cruzando vendas daquele produto com ads do mesmo projeto/período.
- **ProjetoFinancas**: Passar `ads` como prop para `FinancasProdutos`.

**Arquivos**: `src/components/financas/FinancasProdutos.tsx`, `src/components/financas/FinancasPerformance.tsx`, `src/components/projeto/ProjetoFinancas.tsx`

---

## 2. Receita — campos de Quantidade de Vendas e Lucro no form

**Problema**: O dialog de "Adicionar/Editar Receita" em `ProjetoFinancas.tsx` só tem Descrição, Fonte, Data, Valor, Plataforma, Produto, PIX, Documento. Não tem campo de quantidade de vendas, nem mostra lucro bruto/líquido.

**Solução**:
- Adicionar campo `quantidade` (número inteiro, default 1) no form de receita
- Adicionar campo `custo_produto` (valor do custo associado àquela receita, opcional) para calcular lucro
- Exibir abaixo dos campos um resumo calculado: **Lucro Bruto** = valor × quantidade - custo_produto, **Ticket Médio** = valor / quantidade
- Na tabela de receitas, adicionar colunas Qtd e Lucro
- Isso requer adicionar colunas `quantidade` e `custo_produto` na tabela `imphq_project_revenue`

**Arquivos**: `src/components/projeto/ProjetoFinancas.tsx`, migration SQL

---

## 3. Explicação clara de como os dados do Facebook chegam

**Problema**: O usuário não entende como os valores do Facebook chegam ao sistema. Atualmente os dados de Ads são 100% manuais (importação de CSV). Não há integração automática com a API do Facebook.

**Solução**: Adicionar um bloco informativo na aba "Ads" e na "Performance" explicando claramente o fluxo:

> **Como os dados do Facebook chegam aqui?**
> 
> **Ads (gastos)**: Você exporta o relatório CSV do Gerenciador de Anúncios do Facebook e importa aqui via botão "Importar CSV". Os dados não são puxados automaticamente — é necessário importar periodicamente.
> 
> **Vendas**: Chegam automaticamente via webhook de pagamento (Hotmart/Kiwify/Ticto). Quando um cliente compra, o webhook registra a venda com produto, valor e data.
> 
> **Performance**: Cruza os dados de Ads importados com as vendas recebidas via webhook para calcular ROAS, CPA e lucro.

Adicionar um card/banner compacto com ícone de info, colapsável, no topo da aba Ads e na Performance.

**Arquivos**: `src/components/projeto/ProjetoFinancas.tsx`, `src/components/financas/FinancasPerformance.tsx`

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| SQL migration | Adicionar `quantidade` (int default 1) e `custo_produto` (numeric default 0) em `imphq_project_revenue` |
| `src/components/financas/FinancasProdutos.tsx` | Receber prop `ads`, incluir custos ads no cálculo por produto |
| `src/components/financas/FinancasPerformance.tsx` | Custos e lucro no breakdown por produto + banner explicativo |
| `src/components/projeto/ProjetoFinancas.tsx` | Campos quantidade/custo no form receita, colunas na tabela, passar ads para Produtos, banner explicativo na aba Ads |


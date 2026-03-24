

# Plano: Produtos do Briefing nos Custos/Receitas + Campos extras na Receita + Links nos Produtos

## Resumo

Três melhorias para cruzar melhor os dados financeiros com os produtos do projeto:

1. **Selecionar produto do briefing** nos formulários de custo e receita (em vez de digitar texto livre)
2. **Campos extras na receita**: PIX (chave/número), data de pagamento, plataforma de origem (Ticto, Hotmart, etc.)
3. **Múltiplos links por produto** no briefing

## 1. Migration: novos campos em `imphq_project_revenue`

```sql
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS pix_info TEXT;
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS plataforma TEXT;
```

- `pix_info`: chave PIX, número do comprovante, etc.
- `data_pagamento`: data efetiva do pagamento (diferente de `data_ref` que é referência contábil)
- `plataforma`: Hotmart, Kiwify, Ticto, Stripe, PIX, etc.

## 2. Formulário de Receita — melhorias (`ProjetoFinancas.tsx`)

- **Produto**: trocar `Input` por `Select` que lista os produtos do briefing (`project.data.produtos`). O componente precisa receber o `project` como prop (ou carregar o projeto pelo `projectId`)
- Adicionar campos: PIX Info, Data de Pagamento, Plataforma (select com opções: Hotmart, Kiwify, Ticto, Stripe, PIX, Manual, Outro)
- Tabela de receitas: mostrar colunas Plataforma e Data Pagamento

## 3. Formulário de Custo — selecionar produto

- Adicionar campo opcional "Produto" no custo também (mesmo select do briefing), para poder filtrar custos por produto
- Requer `ALTER TABLE imphq_project_costs ADD COLUMN IF NOT EXISTS produto_nome TEXT`

## 4. Múltiplos links por produto (`ProjetoBriefing.tsx`)

Atualmente cada produto tem um campo `link` (string). Mudar para `links` (array de strings):
- Renderizar lista de inputs com botão "+" para adicionar mais
- Botão "x" em cada link para remover
- Manter compatibilidade: se `link` existe e `links` não, migrar automaticamente no render

## 5. Aba Produtos — mostrar dados do briefing + vendas cruzadas

Passar os produtos do briefing para `FinancasProdutos` para exibir todos os produtos (mesmo sem vendas) e cruzar com receitas manuais que têm `produto_nome`.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `pix_info`, `data_pagamento`, `plataforma` em revenue + `produto_nome` em costs |
| `src/components/projeto/ProjetoFinancas.tsx` | Carregar projeto, select de produtos, campos extras no form de receita e custo |
| `src/components/projeto/ProjetoBriefing.tsx` | Suporte a múltiplos links por produto |
| `src/components/financas/FinancasProdutos.tsx` | Receber produtos do briefing como prop, cruzar com receitas |




# Plano: Documentos nos Custos + Edição + Visão de Produtos

## O que será feito

### 1. Adicionar coluna `documento_url` na tabela `imphq_project_costs`
Migration para adicionar `documento_url TEXT` — permitirá anexar um comprovante/NF a cada custo.

### 2. Editar custos existentes
Atualmente só é possível adicionar e excluir. Vamos adicionar um botão de edição em cada linha da tabela de custos que abre o mesmo dialog preenchido, permitindo alterar nome, valor, categoria, moeda, recorrência e documento.

### 3. Upload de documento no formulário de custo
No dialog de adicionar/editar custo, incluir o componente `FileUpload` já existente no projeto para anexar arquivos (PDF, imagem). O arquivo será salvo no bucket Supabase Storage (`project-docs`) e a URL gravada no campo `documento_url`. Na tabela, um ícone de clipe aparecerá nos custos que têm documento, clicável para abrir/baixar.

### 4. Nova aba "Produtos" no ProjetoFinancas
Adicionar uma 5ª tab no componente de finanças do projeto que mostra os produtos cadastrados no briefing (`project.data.produtos`) cruzados com as vendas reais (`imphq_vendas`). Para cada produto:
- Nome, tipo, preço cadastrado
- Vendas reais (quantidade e receita do `imphq_vendas` filtrando por `produto_nome`)
- Ticket médio real vs preço cadastrado
- % da receita total

Isso dá visibilidade completa do desempenho de cada produto.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | `ALTER TABLE imphq_project_costs ADD COLUMN documento_url TEXT` |
| Migration SQL | Criar bucket `project-docs` com RLS |
| `src/components/projeto/ProjetoFinancas.tsx` | Adicionar edição de custos, upload de documento, nova aba Produtos |

## Detalhes técnicos

- O dialog de custo vira dual-purpose (add/edit) com estado `editingCost`
- Upload usa o componente `FileUpload` existente apontando para bucket `project-docs`
- A aba Produtos recebe `projectData` como prop para acessar os produtos do briefing e cruza com `vendas` já carregadas
- Sem novas dependências


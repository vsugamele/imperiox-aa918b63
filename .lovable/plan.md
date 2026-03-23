

# Plano: Edição de Receitas com Produto + Lightbox em Referências

## 1. Migration: adicionar `produto_nome` e `documento_url` na tabela `imphq_project_revenue`

Novos campos opcionais para vincular receita a um produto e anexar comprovante:
```sql
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS produto_nome TEXT;
ALTER TABLE imphq_project_revenue ADD COLUMN IF NOT EXISTS documento_url TEXT;
```

## 2. Edição completa de Receitas (`ProjetoFinancas.tsx`)

Aplicar o mesmo padrão já usado nos custos:
- Estado `editingRevenue` + dialog dual-purpose (add/edit)
- Botão de editar (lápis) em cada linha da tabela de receitas
- Campo opcional "Produto" (select com os produtos do briefing ou texto livre)
- Upload de documento (comprovante) usando `FileUpload` no bucket `project-docs`
- Ícone de clipe na tabela quando há documento anexado
- Coluna "Produto" na tabela de receitas para visualização

## 3. Lightbox de imagem em Referências (`Referencias.tsx`)

- Ao clicar no card, se tem imagem, abrir um dialog/lightbox com a imagem em tamanho grande antes do painel de edição
- Ou: adicionar botão "ver imagem" no dialog de edição que abre a imagem em nova aba/lightbox
- Abordagem: dialog separado com `<img>` full-size + botão fechar

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Migration SQL | `ALTER TABLE` para `produto_nome` e `documento_url` |
| `src/components/projeto/ProjetoFinancas.tsx` | Dialog de receita dual-purpose, campo produto, upload doc |
| `src/pages/Referencias.tsx` | Lightbox para visualizar imagens em tamanho grande |


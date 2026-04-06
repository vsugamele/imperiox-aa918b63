

# Plano: Duplicar Formulario + Template + Visibilidade de Dados no Lead

3 problemas identificados.

---

## Problema 1: Nao tem opcao de duplicar formulario

O `FormBuilder.tsx` tem botoes "Editar", "Snippet" e "Excluir" (linhas 392-400), mas nao tem "Duplicar". Tambem nao salva templates customizados — so usa templates hardcoded (`FORM_TEMPLATES`).

### Fix

**Duplicar**: Adicionar botao "Duplicar" ao lado de "Snippet". Ao clicar, copia o formulario inteiro (nome + " (cópia)", mesmos campos, mesmo projeto/stage/product) e insere como novo registro no banco.

**Salvar como Template**: Adicionar opcao "Salvar Template" que insere o formulario na lista `imphq_capture_forms` com um flag `is_template: true` no campo `settings`. Na tela de templates, carregar tambem os templates salvos do banco alem dos hardcoded.

---

## Problema 2: Dados de projeto/form/produto nao aparecem no lead

A tabela de leads (linha 983-1013) mostra: Lead, Produto, Pagamento, Estagio, Score, Receita, Desde. Porem:
- **Projeto** nao aparece na tabela (so no sidebar)
- **Formulario de origem** nao aparece em lugar nenhum
- **Produto** so vem de `_vendas`, nao do formulario/captura

O lead sabe `project_id` mas nao mostra na tabela. O `capture-lead` salva `form_id` nos responses e na interacao, mas o lead detail nao exibe de qual form veio.

### Fix

**Tabela de leads**: Adicionar coluna "Projeto" (nome do projeto com icon, ou "—") entre "Lead" e "Produto".

**Lead Detail (aba Dados)**: Adicionar secao "Origem" mostrando:
- Projeto (nome)
- Formulario de origem (buscar do primeiro FormResponse ou de `data.interacoes[0].form_id`)
- Produto do formulario (de `settings.product_name` do form)

**Aba Qualificacao**: As respostas de formulario ja aparecem, mas sem identificar QUAL formulario. Agrupar por `form_id` com header mostrando nome do form.

---

## Problema 3: Respostas de formulario sem contexto de form/projeto

Na aba Qualificacao, as respostas aparecem como lista flat sem indicar de qual formulario vieram. O `loadTimeline` ja busca `imphq_capture_forms(nome)` junto com os responses, mas na aba Qualificacao renderiza sem agrupamento.

### Fix

Agrupar `formResponses` por `form_id` e exibir com header do nome do formulario.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/leads/FormBuilder.tsx` | Botao Duplicar + Salvar como Template + carregar templates do banco |
| `src/pages/Leads.tsx` | Coluna Projeto na tabela + Origem no lead detail + Agrupar respostas por form |

## Ordem

1. FormBuilder: duplicar + templates
2. Leads.tsx: coluna projeto + origem + agrupamento respostas


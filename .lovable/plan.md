

# Plano: Templates de Formulario + Filtros em Financas

---

## 1. Templates Prontos no FormBuilder

Adicionar um sistema de templates pre-definidos para formularios de captura. Quando o usuario clicar "Novo Formulario", pode escolher um template ou comecar do zero.

**Templates incluidos:**
- Captura Simples (nome + email + whatsapp)
- Pesquisa Pre-Webinar (nome, email, faturamento, maior dor, nivel de consciencia)
- Aplicacao/Mentoria (nome, email, phone, instagram, faturamento, nicho, objetivo)
- Pesquisa Pos-Compra (nome, email, como conheceu, nota de 1-10, depoimento)
- Lead Magnet (nome, email, profissao)

**Seletor de Produto:** Adicionar campo "Produto" no formulario, puxando os produtos do projeto selecionado (campo `data.produtos` do `imphq_projects`). Isso vincula o formulario a um produto especifico, facilitando cruzamento de dados.

### Mudancas em `FormBuilder.tsx`:
- Array `FORM_TEMPLATES` com templates pre-definidos
- Ao clicar "Novo Formulario", mostrar dialog de selecao de template antes do editor
- Novo campo `product_name` no state do form (salvo no `settings` JSONB do `imphq_capture_forms`)
- Select de produto que aparece apos selecionar um projeto (busca produtos do projeto)
- Cards de template com icone, nome e descricao dos campos incluidos

---

## 2. Filtros de Data e Produto em Financas

Financas ja tem filtro de projeto. Adicionar:

### Filtro de Data
- Dois inputs de data (de/ate) ao lado do Select de projeto
- Botoes rapidos: "Hoje", "7d", "30d", "Este mes", "Todos"
- Filtrar `vendas` por `data_venda`, `ads` por `data_ref`, `projectRevenues` por `data_ref`

### Filtro de Produto
- Select com produtos unicos extraidos das vendas (`produto_nome` da tabela `imphq_vendas`)
- Default: "Todos os Produtos"
- Filtra vendas pelo `produto_nome` selecionado

### Mudancas em `Financas.tsx`:
- Novos states: `filterDateFrom`, `filterDateTo`, `filterProduct`
- Logica de filtragem aplicada nos arrays `fVendas`, `fAds`, `fProjectRevenues`
- UI: linha de filtros com projeto + produto + datas + botoes rapidos
- KPIs e graficos reagem automaticamente aos filtros

---

## Resumo de Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/leads/FormBuilder.tsx` | Templates pre-definidos, seletor de produto, dialog de template |
| `src/pages/Financas.tsx` | Filtros de data (de/ate + atalhos) e filtro de produto |


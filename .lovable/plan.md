

# Plano: Importação Completa de CSV + Filtro por Produto + Delete de Lead

## Problemas Identificados

1. **Importação perde dados importantes do CSV**: O CSV da Ticto tem colunas ricas que não estão sendo capturadas — método de pagamento (Pix/Cartão), bandeira, parcelas, código do pedido, data do pedido, bump, CPF, UTMs completas (src, sck, utm_source, utm_content, utm_medium, utm_term, utm_campaign, tvar), tracking geo (city/state/country).
2. **Não separa por produto**: Um mesmo pedido pode ter múltiplos produtos (ex: "Código dos Cortes Perfeitos" + "Segredo do Corte" bump). Precisa filtrar por produto na sidebar.
3. **Delete de lead**: Já existe `deleteLead()` no código, mas falta confirmação antes de deletar. Além disso, precisa deletar vendas associadas (FK constraint).

## Alterações

### 1. `src/components/leads/LeadImportDialog.tsx` — Capturar todos os dados do CSV

Atualizar `MappedRow` e `mapRow()` para extrair:

```text
Novos campos em MappedRow:
  metodo_pagamento: "Pix" | "Cartão de Crédito" | ...
  bandeira_cartao: "visa" | "mastercard" | ...
  parcelas: number
  bump: boolean
  codigo_pedido: string
  codigo_transacao: string
  data_pedido: string
  documento: string (CPF)
  oferta: string (Nome da Oferta)
  valor_pedido: number (valor total do pedido)
  comissao_produtor: number
  src, sck: string (UTMs extras da Ticto)
```

Esses dados extras vão para `lead.data` (JSONB) e `imphq_vendas.data` (JSONB), sem precisar de migração.

Mapeamento Ticto atualizado:
- `findCol(row, "Método de Pagamento")` → `metodo_pagamento`
- `findCol(row, "Bandeira do Cartão")` → `bandeira_cartao`
- `findCol(row, "Quantidade de Parcelas")` → `parcelas`
- `findCol(row, "Bump")` → bump (Sim/Não)
- `findCol(row, "Código do Pedido")` → `codigo_pedido`
- `findCol(row, "src")` → utm src
- `findCol(row, "sck")` → utm sck
- `findCol(row, "utm_source", "Fonte de Tráfego")` → melhor mapeamento UTM
- `findCol(row, "utm_content")` → utm_content direto
- `findCol(row, "utm_campaign")` → utm_campaign direto
- `findCol(row, "tracking_city", "tracking_state")` → geo

Na hora de inserir em `imphq_vendas`, salvar `produto_nome`, UTMs nos campos dedicados, e dados extras em `data` JSONB:
```json
{
  "metodo_pagamento": "Pix",
  "parcelas": 1,
  "bump": false,
  "codigo_pedido": "TOP1502DRT84SD",
  "bandeira": "visa",
  "comissao_produtor": 32.98,
  "oferta": "O Código do Corte Perfeito"
}
```

Preview na tabela do dialog: adicionar coluna "Pagamento" e "Produto".

### 2. `src/pages/Leads.tsx` — Filtro por Produto na Sidebar

Adicionar na sidebar (abaixo dos projetos) um filtro por **produto**:
- Extrair produtos únicos das vendas em `imphq_vendas` agrupando por `produto_nome`
- Mostrar como sub-filtro quando um projeto está selecionado
- Novo state `productFilter` com lógica: carregar vendas dos leads filtrados, cruzar `lead_id`

Também na sidebar do projeto, mostrar contagem de leads por estágio (mini funil visual).

### 3. `src/pages/Leads.tsx` — Confirmação de Delete

Adicionar `AlertDialog` de confirmação antes de deletar:
- "Tem certeza? Isso irá remover o lead e todas as vendas associadas."
- Na função `deleteLead`: primeiro deletar vendas (`imphq_vendas` WHERE `lead_id`), depois deletar o lead

### 4. Preview melhorada no Import Dialog

Mostrar mais colunas no preview: Nome, Email, Status, Pagamento, Parcelas, Valor, Produto.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/leads/LeadImportDialog.tsx` | Capturar todos os campos do CSV, salvar em data JSONB, melhorar preview |
| `src/pages/Leads.tsx` | Filtro por produto, confirmação de delete, deletar vendas antes do lead |

Sem migração necessária — todos os dados extras vão em campos JSONB existentes (`data` em `imphq_leads` e `imphq_vendas`) e campos UTM já existentes em `imphq_vendas`.




# Plano: Seleção em Massa, Filtros Avançados e Jornada com Importações

## O que falta

1. **Select all / alguns + deletar em massa**: Checkbox na tabela para selecionar leads individualmente ou todos, com botão "Excluir selecionados"
2. **Filtro por projeto e produto na barra principal** (mobile-friendly, já que sidebar é `hidden lg:block`)
3. **Jornada registrar importações**: Quando um CSV é importado, registrar evento "CSVImport" no `imphq_events` para aparecer na timeline. Cruzar importações futuras (formulários, outros CSVs) pelo email

## Alterações

### 1. `src/pages/Leads.tsx` — Seleção em massa

- Adicionar state `selectedIds: Set<string>` e `selectAll: boolean`
- Checkbox no header da tabela (select all filtered) e em cada row
- Barra de ações flutuante quando há seleção: "X selecionados | Excluir | Desmarcar"
- Função `deleteSelected()`: deleta vendas e leads em batch
- AlertDialog de confirmação para deleção em massa

### 2. `src/pages/Leads.tsx` — Filtros de projeto/produto no mobile

- Adicionar selects de Projeto e Produto na barra de filtros (ao lado de Plataforma/Status/Estágio) para funcionar em telas sem sidebar
- Manter sidebar como navegação rápida em desktop

### 3. `src/components/leads/LeadImportDialog.tsx` — Registrar evento de importação

- Após importar cada lead, inserir evento `CSVImport` em `imphq_events` com dados: plataforma de origem, produto, status original, método de pagamento
- Isso permite que na Jornada do lead apareça "📥 Importado via CSV (Ticto)" com os detalhes

### 4. `src/pages/Leads.tsx` — Timeline reconhecer CSVImport

- Adicionar `CSVImport` ao `EVENT_CONFIG` com ícone `FileUp` e label "Importado CSV"
- Na timeline, mostrar detalhes da importação (produto, plataforma, data original do pedido)

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Leads.tsx` | Checkboxes de seleção, barra de ações em massa, filtros projeto/produto no mobile, CSVImport na timeline |
| `src/components/leads/LeadImportDialog.tsx` | Registrar evento CSVImport no imphq_events por lead importado |


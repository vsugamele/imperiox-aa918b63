

# Plano: Melhorias CRM, Chat, Finanças, Dashboard e Deduplicação

## Resumo das 11 melhorias solicitadas

---

### 1. Leads -- Dados importados visíveis na tabela e no detalhe

**Problema**: O import salva dados ricos (produto, pagamento, UTMs, parcelas) no JSONB de `imphq_vendas.data`, mas a tabela principal e o detalhe do lead não exibem nada disso.

**Solução** (`src/pages/Leads.tsx`):
- Carregar vendas junto com leads: `imphq_vendas` por `lead_id` para cada lead
- Adicionar colunas na tabela: **Produto**, **Pagamento**, **Score**
- No detalhe do lead (tab Dados), mostrar seção "Dados de Compra": produto, método de pagamento, parcelas, bandeira, código do pedido, UTMs como badges, documento/CPF, oferta, valor liquidado
- Adicionar campo **Notas** (textarea salvo em `data.notas`)
- Calcular **Lead Score** automático: email (+10), compra (+30), UTM (+5), múltiplas compras (+20) -- exibir como barra de progresso

### 2. Chat -- Deletar mensagens + carregamento mais rápido

**Solução** (`src/pages/Chat.tsx`):
- Adicionar botão de deletar mensagem (ícone lixeira no hover, só para mensagens do próprio usuário)
- Usar realtime channel ao invés de polling -- já está implementado via `postgres_changes` para INSERT, adicionar listener para DELETE
- Carregar últimas 200 mensagens (aumentar de 100)
- Adicionar realtime para DELETE events no channel

### 3. Finanças -- Separação visual empresa vs projetos

**Solução** (`src/pages/Financas.tsx`):
- Na aba Overview, separar visualmente em 2 seções: "🏢 Custos da Empresa" (tabela `imphq_custos`) e "📁 Custos dos Projetos" (tabela `imphq_project_costs`)
- Adicionar card separado no topo: "Custo Empresa: R$ X" vs "Custo Projetos: R$ X" vs "Receita: R$ X"
- Badge de cor diferente para cada tipo

### 4. Projeto Finanças -- Chave PIX e data de pagamento nos custos

**Problema**: O form de custos não tem campos para PIX e data de pagamento.

**Solução** (`src/components/projeto/ProjetoFinancas.tsx`):
- Adicionar ao `costForm`: `pix_info` e `data_pagamento`
- Adicionar campos no dialog de custo
- Salvar no banco (precisa migration para adicionar colunas `pix_info TEXT` e `data_pagamento DATE` em `imphq_project_costs`)

### 5. Deduplicação de vendas no import

**Problema**: Import cria venda nova para cada linha CSV, mesmo que já exista.

**Solução** (`src/components/leads/LeadImportDialog.tsx`):
- Antes de inserir em `imphq_vendas`, verificar se já existe registro com mesmo `lead_id` + `codigo_pedido` (ou `lead_id` + `valor` + `data_pedido` se não tiver código)
- Se existir, pular o insert e não contar como "nova venda"

### 6. Produtos via webhook viram produtos no briefing

**Solução** (`supabase/functions/webhook-pagamento/index.ts`):
- Após processar o webhook, verificar se o `produto` já existe na lista de produtos do briefing do projeto (`data.produtos[]`)
- Se não existir, fazer append: `data.produtos.push({ nome: produto, tipo: "Infoproduto" })`
- Atualizar o projeto com o novo array

### 7. Ads -- Empty state com mensagem sobre API

**Solução** (`src/components/projeto/ProjetoFinancas.tsx` e `src/components/financas/FinancasAds.tsx`):
- No empty state de Ads, mudar a mensagem para: "Nenhum dado de Ads disponível. Importe um CSV de relatório ou conecte a API do Facebook/Google para importação automática."

### 8. Dashboard -- Mensagens urgentes

**Problema**: O card "Tarefas Urgentes" não filtra por prioridade urgente/alta.

**Solução** (`src/pages/Dashboard.tsx`):
- Filtrar `urgentTasks` por `priority IN ('urgent', 'high')` ou `due_date < now()`
- Adicionar `.in("priority", ["urgent", "high"])` na query OU `.lt("due_date", new Date().toISOString())`

### 9. Tarefas -- Admin vê tarefas pessoais de outros

**Solução** (`src/pages/Tarefas.tsx`):
- Verificar se o usuário é admin (via `imphq_team_members` com role admin ou similar)
- Se admin, carregar tarefas de todos os usuários
- Adicionar badge com nome do responsável em cada tarefa

### 10. Dashboard -- Receita total com blur para não-admin

**Solução** (`src/pages/Dashboard.tsx`):
- Adicionar card "Receita Total" calculando soma de `imphq_vendas` + `imphq_project_revenue`
- Verificar role do usuário; se não admin, aplicar `filter blur-md` no valor
- Tooltip: "Apenas administradores podem ver valores"

---

## Migration necessária

```sql
ALTER TABLE imphq_project_costs
  ADD COLUMN IF NOT EXISTS pix_info TEXT,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;
```

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `pix_info` e `data_pagamento` em `imphq_project_costs` |
| `src/pages/Leads.tsx` | Colunas produto/pagamento/score na tabela, dados de compra no detalhe, notas, UTMs como badges |
| `src/pages/Chat.tsx` | Botão deletar mensagem, realtime para DELETE, carregar mais mensagens |
| `src/pages/Financas.tsx` | Separação visual empresa vs projetos nos KPIs |
| `src/components/projeto/ProjetoFinancas.tsx` | Campos PIX e data pagamento nos custos, empty state Ads melhorado |
| `src/components/leads/LeadImportDialog.tsx` | Deduplicação de vendas por codigo_pedido |
| `supabase/functions/webhook-pagamento/index.ts` | Auto-criar produto no briefing do projeto |
| `src/pages/Dashboard.tsx` | Card receita total com blur, fix tarefas urgentes |
| `src/pages/Tarefas.tsx` | Admin vê tarefas de todos |
| `src/components/financas/FinancasAds.tsx` | Empty state com mensagem sobre API |


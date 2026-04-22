

## Plano: Corrigir build error em `FinancasAds.tsx`

O refactor anterior removeu acidentalmente a tag de abertura `<Dialog open={showForm} onOpenChange={setShowForm}>` antes do `<DialogContent>` na linha 564, deixando JSX mal formado e quebrando o build.

### Correção
- Em `src/components/financas/FinancasAds.tsx`, na linha 562/563 (entre o `</Tabs>` e `<DialogContent>`), inserir:
  ```tsx
  <Dialog open={showForm} onOpenChange={setShowForm}>
  ```
- A tag `</Dialog>` na linha 601 já existe e fecha corretamente esse bloco.

### Próxima etapa (após build voltar)
Em sequência (segundo plano aprovado anterior), implementar os 4 blocos estratégicos do `ProjetoComando.tsx`:
1. **Pulso de Hoje** (4 mini-cards: receita hoje vs ontem, leads hoje vs média 7d, vendas hoje, gasto ads hoje).
2. **Top 3 Produtos do mês** (click abre `ProductInsightDrawer`).
3. **Alertas Inteligentes** (reusa `DashboardAlerts` filtrado por `projectId`).
4. **Próximas Ações** (merge tarefas Kanban urgentes + eventos calendário 48h).

### Arquivos
- **Editar**: `src/components/financas/FinancasAds.tsx` — adicionar 1 linha (`<Dialog>` wrapper).
- **Editar**: `src/components/projeto/ProjetoComando.tsx` — adicionar os 4 blocos no topo do conteúdo atual.

### Fora de escopo
- Outros refactors de UI nesta rodada.


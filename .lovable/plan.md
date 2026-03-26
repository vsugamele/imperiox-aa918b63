

# Status: Tudo do Plano Anterior Foi Implementado

As 10 melhorias do plano foram todas aplicadas com sucesso:

| Item | Status |
|---|---|
| Leads -- dados ricos na tabela (Produto, Pagamento, Score, Receita) | Implementado |
| Leads -- Dados de Compra, Notas, UTMs no detalhe | Implementado |
| Leads -- Lead Score automatico | Implementado |
| Chat -- deletar mensagens + realtime DELETE + 200 msgs | Implementado |
| Financas -- KPIs separados Empresa vs Projetos | Implementado |
| ProjetoFinancas -- PIX + data pagamento | Implementado (migration aplicada) |
| LeadImportDialog -- deduplicacao vendas | Implementado |
| Dashboard -- receita total com blur, tarefas urgentes | Implementado |
| Tarefas -- admin ve tarefas de todos | Implementado |
| Ads -- empty state melhorado | Implementado |

O webhook-pagamento com auto-criacao de produto no briefing tambem esta no codigo, mas a **edge function precisa ser redeployada** para a alteracao entrar em producao.

---

## Proximas Oportunidades de Melhoria

Com tudo do plano anterior resolvido, identifico estas oportunidades:

### 1. Deploy do webhook-pagamento atualizado
A edge function foi editada mas pode nao ter sido deployada. Precisa redeploy.

### 2. Filtro rapido "Pendentes" no CRM
O KPI de "Pix Pendente" e "Carrinho" ja existe, mas clicar neles nao filtra a tabela. Transformar os KPI cards em botoes de filtro rapido.

### 3. Tags inline na tabela de leads
Mostrar as 2 primeiras tags como mini-badges na coluna do lead (ao lado do nome).

### 4. Documento/CPF visivel no detalhe
O campo `documento` do CSV importado esta no JSONB mas nao aparece no detalhe do lead.

### 5. Chat -- nome do usuario nas mensagens
Atualmente so mostra user_id. Poderia mostrar o nome do membro da equipe.

Quer que eu implemente alguma dessas melhorias ou tem outra prioridade?


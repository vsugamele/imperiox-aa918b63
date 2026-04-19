
Objetivo: corrigir a coluna Receita em Leads para sempre mostrar os valores certos.

1. Confirmar a causa no fluxo atual
- A tabela `LeadsTable` mostra só `lead.total_gasto`.
- O `webhook-pagamento` já recalcula `total_gasto`.
- O `LeadImportDialog` insere vendas aprovadas em `imphq_vendas`, mas não recalcula `imphq_leads.total_gasto`.
- Resultado: lead pode aparecer como “Compra ✓”, mas a coluna Receita fica `—`.

2. Corrigir a origem do problema
- Criar uma migration com função/trigger no banco em `imphq_vendas` para recalcular automaticamente:
  - `imphq_leads.total_gasto`
  - `imphq_leads.status`
- Disparar em `INSERT`, `UPDATE` e `DELETE`.
- Regra de soma: considerar status aprovados (`aprovado`, `aprovada`, `approved`, `paid`, etc.) para evitar novas inconsistências.

3. Fazer backfill dos dados antigos
- Na mesma entrega, rodar atualização dos leads já existentes para sincronizar:
  - somar vendas aprovadas por `lead_id`
  - zerar quem não tem venda aprovada
  - manter `cliente` só quando houver venda válida

4. Ajustar a UI como proteção
- Em `LeadsTable.tsx`, trocar a regra visual da coluna Receita para não depender só de “truthy/falsy”.
- Exibir `R$ 0` quando for zero real e usar fallback opcional pela soma de `_vendas` aprovadas enquanto o dado sincroniza.
- Isso evita continuar mostrando `—` quando houver dado parcial.

5. Revisar os outros pontos que criam venda
- Verificar `LeadImportDialog.tsx` e qualquer outro fluxo que insere em `imphq_vendas`.
- Se necessário, simplificar esses pontos para confiar no trigger e evitar lógica duplicada.

6. Validação final
- Testar um lead importado com venda aprovada.
- Testar um lead vindo por webhook.
- Testar refund/cancelamento para garantir que a Receita diminui corretamente.
- Conferir a lista `/leads`, o card total de Receita e o detalhe do lead.

Arquivos previstos
- `src/components/leads/LeadsTable.tsx`
- `src/components/leads/LeadImportDialog.tsx` (se precisar ajuste local)
- nova migration em `supabase/migrations/`

Detalhe técnico
- Hoje não existe um mecanismo central no banco para manter `total_gasto` sincronizado.
- O sistema depende de alguns fluxos recalcularem manualmente e outros não fazem isso.
- A correção mais segura é mover essa responsabilidade para o banco, deixando a coluna Receita consistente em qualquer origem de venda.

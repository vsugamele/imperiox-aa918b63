
# Plano: Modal de detalhes, merge IA, plano mensal no portal, integração Kanban

## 5 problemas identificados

1. **Cards sem clique** — Não há modal para ver/editar detalhes do card de conteúdo
2. **IA apaga plano existente** — `handleContentPlanAI` (linha 168) sobrescreve `content_plan` inteiro com resultado da IA
3. **Portal público não exibe mensal** — `ExpertPortal.tsx` já tem 4 semanas com tabs (OK, já funciona)
4. **Tarefas do Kanban no portal** — Já aparecem via `.contains("tags", [projectId])`, mas precisam de melhor exibição
5. **Falta integração IA ↔ Expert** — O painel não conecta sugestões de IA com o fluxo de trabalho do expert

---

## Solução 1: Modal central para detalhes do card

Ao clicar num card de conteúdo, abre um **Dialog** central com:
- Plataforma e tipo (selects)
- Descrição/tema (textarea maior)
- Sugestão de copy (campo de texto livre)
- Hashtags sugeridas
- Botão "Gerar Copy com IA" que chama a mente para criar o texto do post
- Botão excluir

**Novo campo no ContentItem**: `copy?: string`, `hashtags?: string`

## Solução 2: IA preenche só vazios (merge)

No `handleContentPlanAI`, em vez de sobrescrever:
- Para cada semana → cada dia: se o dia já tem cards, **não sobrescreve**
- Só preenche dias com array vazio ou inexistente
- Exibir toast informando quantos dias foram preenchidos vs. preservados

## Solução 3: Tarefas do Kanban melhor integradas

- No Painel Expert interno: já aparecem, manter
- No Portal público (`expert-portal` edge function): já busca via `.contains("tags", [projectId])` — OK
- Melhorar exibição no portal público: mostrar coluna (status) do card, deadline, e checklist summary se existir

## Solução 4: Integração IA ↔ Expert

- Dentro do modal do card: botão "✨ Gerar Copy" que usa o contexto do avatar + tema do card para gerar copy pronta
- No painel de notas: já tem "Gerar Instruções com IA" — manter
- Adicionar no topo do plano de conteúdo: botão "Preencher vazios com IA" (diferente do "Gerar Plano") para completar só o que falta

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/projeto/ProjetoExpertPanel.tsx` | Adicionar modal de detalhes do card + merge logic na IA + botão "Preencher vazios" |
| `src/pages/ExpertPortal.tsx` | Melhorar exibição de tarefas (status, checklist) |
| `supabase/functions/expert-portal/index.ts` | Incluir `column_id` e `checklist` nos dados de tasks |

## Ordem

1. Criar modal central de detalhes do card (com campos expandidos + IA)
2. Implementar merge logic (IA preenche só dias vazios)
3. Melhorar exibição de tarefas no portal público
4. Adicionar botão "Preencher vazios com IA" separado

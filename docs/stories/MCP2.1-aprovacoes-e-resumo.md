# MCP2.1 — MCP: fila de aprovações e resumo do projeto

**Status:** Done (02/10/2026)

## Objetivo
Uma IA (Claude, agentes) consegue ver e decidir a fila "Aprovar" e ler o resumo do projeto em uma chamada, sem abrir a tela.

## Acceptance Criteria
- [x] `get_approvals(project_id?, limit?)`: mesma fila e ordem de `/aprovar` (`buildApprovalQueue`), com `key` e o que o MCP pode decidir (`decisao_pelo_mcp`)
- [x] `decide_approval(key, decision, motivo?)`: etapa (feita / volta para em andamento, motivo nas notas), conteúdo (aprovado/reprovado), ação da IA só reprovar; resposta para cliente só na tela
- [x] Recusa decidir item que não está mais esperando
- [x] `get_briefing(project_id)`: vendas, faturamento e leads de hoje, faturamento do mês, leads quentes 2h, etapas do dia (quadro de Hoje) com responsável/prazo/atrasadas e aprovações do projeto
- [x] Testes do handler real (`src/test/mcp-approvals-briefing.test.ts`), suíte 601 verde, deno check na linha de base (9)
- [x] `project-mcp` publicado; sem chave responde 401

## Decisões
- Aprovar ação da IA pelo MCP fica de fora: o `imperius-executor` executa mudança real e exige login de alguém do time. Entra quando houver autonomia por nível de risco.
- Dado real em 02/10: fila com 29 ações da IA propostas (22 JP, 7 sem projeto).

## File List
- `supabase/functions/_shared/project-briefing.ts` (novo)
- `supabase/functions/project-mcp/index.ts`
- `src/test/mcp-approvals-briefing.test.ts` (novo)
- `src/test/map-agent-status-mcp.test.ts` (harness com os módulos novos)

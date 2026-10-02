# Story UX1.1 — Etapa com dono, status e prazo em colunas

Pedido (02/10/2026): melhorar UX/CX e animações e facilitar a operação para o Vinicius, para o sócio (Bruno) e para a IA. Ordem aprovada:
1. Dono e status em colunas (esta story).
2. Resumo diário no WhatsApp e fila única de aprovação.
3. Fluxo vivo e feedback animado.

## Feito (02/10/2026)

### Banco
- [x] Colunas novas em `imphq_company_map_nodes`, migração `20261002_imphq_map_nodes_owner_status.sql`, aplicada:
  - `step_status`, com check dos 4 valores;
  - `owner_member_id`, que referencia `imphq_team_members`;
  - `due_date`;
  - `status_changed_at` e `status_changed_by`.
- [x] Backfill conferido: nenhuma das 99 etapas tinha `[agent_status:…]` declarado, então nada mudou de status.

### Leitura e gravação
- [x] Leitor único `readStepStatus`, em `_shared/map-contract.ts`: primeiro a coluna, depois a marcação declarada nas notas, por último "sem status".
- [x] Usam o leitor novo:
  - `stepStatus` e `needsConfirmation`;
  - o card do mapa;
  - `extractAgentData`;
  - as 3 rotas de etapas do MCP.
- [x] Gravação na coluna e também na marcação das notas, por compatibilidade:
  - status na tela Hoje e no painel do canvas;
  - `complete_step` do MCP, nas duas rotas;
  - etapas criadas por playbook já nascem `pending`.
- [x] Regras puras em `_shared/map-steps.ts`: `dueState` (atrasada, hoje, em breve, no prazo; etapa feita não atrasa), `localDate`, `addDays` e `firstName`.

### Tela Hoje
- [x] Filtro por pessoa (Tudo / Meu dia / Bruno / Sem dono), lembrado no navegador.
  - "Sem dono" só mostra etapas do time; as de IA ficam de fora.
  - O progresso do projeto não muda com o filtro.
- [x] Cada etapa tem um chip de prazo e um chip de responsável, com atribuição em um clique.
  - Prazos rápidos: hoje, amanhã, em 3 dias, em 1 semana, sem prazo.
- [x] Dentro de cada grupo, o atrasado sobe. O indicador mostra quantas etapas estão atrasadas.
- [x] As linhas entram e saem com animação.

### Mapa
- [x] O card mostra o responsável e o prazo, com cor por situação.
- [x] O painel da etapa tem Responsável e Prazo.

### MCP (publicado)
- [x] As etapas trazem `responsavel`, `prazo` e `situacao_prazo`.
- [x] `get_executable_steps` aceita o filtro `responsavel` (nome, e-mail, id ou `sem_dono`).
- [x] Ferramenta nova `assign_step`, que define responsável e/ou prazo.
- [x] O tipo do cliente Supabase foi corrigido: o `deno check` caiu de 14 para 9 erros, todos antigos.

### Testes
- [x] `src/test/step-owner-status.test.ts`.
- [x] `hoje.test.tsx` ampliado.
- [x] O harness do MCP foi atualizado.
- [x] Resultado: 589 testes passando.

## Pendente
- [ ] Atribuir os responsáveis das etapas existentes. A decisão é do Vinicius e do Bruno: hoje todas estão sem dono.
- [ ] O nome do Vinicius em `imphq_team_members` está como "Viniicus" e aparece assim nos chips. Corrigir em /equipe.
- [ ] Conferência visual logado.

## File List
- supabase/migrations/20261002_imphq_map_nodes_owner_status.sql
- supabase/functions/_shared/map-contract.ts
- supabase/functions/_shared/project-map.ts
- supabase/functions/_shared/map-steps.ts
- supabase/functions/_shared/playbook-apply.ts
- supabase/functions/project-mcp/index.ts
- src/lib/today-board.ts
- src/hooks/useTodayBoard.ts
- src/hooks/useTeamMembers.ts
- src/pages/Hoje.tsx
- src/components/funis/StepOwnerChips.tsx
- src/components/funis/MapNodeCard.tsx
- src/components/funis/map-node-model.ts
- src/components/funis/map-agent-data.ts
- src/components/funis/CompanyMapCanvas.tsx
- src/integrations/supabase/types.ts
- src/test/step-owner-status.test.ts
- src/test/hoje.test.tsx
- src/test/map-agent-status-mcp.test.ts

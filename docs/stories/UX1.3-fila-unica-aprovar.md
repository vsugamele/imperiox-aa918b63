# Story UX1.3 — Fila única "Aprovar"

Pedido (02/10/2026): juntar num lugar só tudo que espera um sim ou não, com prévia e decisão em um clique.

Decisão do Vinicius: expirar as propostas antigas da IA (mais de 7 dias), sem apagar nada. Daqui pra frente elas expiram sozinhas em 7 dias.

## Feito (02/10/2026)

### Banco
- [x] `imphq_ai_actions` ganhou o status `expired` e a coluna `expired_at`.
- [x] Função `imphq_expire_ai_actions(7)`, agendada todo dia às 03:15 BRT (`imphq-expire-ai-actions`).
- [x] Migração `20261002_imphq_ai_actions_expire.sql`, aplicada.
- [x] Primeira execução: 1.320 propostas expiradas, 29 continuam reais.

### Para a IA não recriar o que expirou
- [x] `imperius-scout` publicado: o dedupe também conta as propostas expiradas nos últimos 30 dias.
- [x] O dedupe agora ordena pelas mais recentes, com limite de 200. Antes, olhava 50 itens quaisquer.

### Regra da fila
- [x] `_shared/approval-queue.ts` define a ordem da fila:
  1. respostas para cliente;
  2. etapas para revisar;
  3. ações da IA, por risco;
  4. conteúdo pronto.
- [x] Dentro de cada grupo, o item que espera há mais tempo vem primeiro. A regra também calcula "esperando há…".

### Tela `/aprovar`
- [x] Item "Aprovar" no menu, logo abaixo de Hoje, com contador.
- [x] Filtros por origem, cada um com sua contagem.
- [x] Cada card mostra a prévia: capa do vídeo, risco e impacto. Os cards entram e saem com animação, e a fila vazia tem um estado próprio.
- [x] Cada item é decidido com a mesma ação da tela de origem:

| Origem | Aprovar | Recusar |
|---|---|---|
| Etapa | vira Feito | Devolver: volta para Em andamento |
| Ação da IA | executa pelo `imperius-executor` | Rejeitar |
| Conteúdo | aprovado | reprovado |
| Resposta para cliente | não é decidida na fila: envia mensagem, então só abre /rascunhos | — |

### Contadores e testes
- [x] Contador do Imperius corrigido: buscava o status `pending`, que não existe, e mostrava sempre 0.
- [x] Testes em `src/test/aprovar.test.tsx`; os tipos de `imphq_content_items` foram adicionados.

## Pendente
- [ ] MCP `get_approvals` e `decide_approval`, para a IA também ver e decidir a fila.
- [ ] Conferência visual logado.

## File List
- supabase/migrations/20261002_imphq_ai_actions_expire.sql
- supabase/functions/imperius-scout/index.ts
- supabase/functions/_shared/approval-queue.ts
- src/hooks/useApprovals.ts
- src/pages/Aprovar.tsx
- src/App.tsx
- src/components/AppSidebar.tsx
- src/hooks/useSidebarBadges.ts
- src/integrations/supabase/types.ts
- src/test/aprovar.test.tsx

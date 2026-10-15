# UX1.5 — Aprovar como caixa única de decisões e Hoje como tela inicial única

**Status:** Pronto para revisão
**Fase:** 3 da reorganização de UX/CX (fase 1: UX1.1 menu por tarefa; fase 2: UX1.2 fábrica passo a passo)

## Contexto
Duas pendências criadas ou encontradas no dia a dia ficavam fora do Aprovar: levas de criativos esperando o sim e
suporte do JP parado com a equipe (14 conversas em 15/10). Além disso, o sistema tinha duas telas iniciais: o menu
abria no Hoje, mas o login e a barra do celular mandavam para o Dashboard (Cockpit).

## Critérios de aceite
- [x] Aprovar mostra **Suporte parado** (handoff/pending em `imphq_jp_conversation_state`), logo depois do pix, com nome, canal, última mensagem e link para a conversa
- [x] Decisões do suporte: **Resolvido** (`confirmed`) e **Não é suporte** (limpa a marcação); nada é enviado ao cliente
- [x] Aprovar mostra **Levas de criativos**: planejada decide na fila (aprovar/descartar, mesma regra do batch-strategist); aprovada só leva à Fábrica para gerar (gerar continua sendo um clique)
- [x] A mesma regra vale para a tela e para o MCP (get_approvals/decide_approval), com níveis de autonomia para as 4 decisões novas
- [x] Contador do menu do Aprovar soma levas planejadas e suporte parado
- [x] Admins leem e fecham o suporte pela tela (políticas de RLS de select/update; inserir e apagar seguem só com a chave de serviço)
- [x] Hoje mostra no topo as decisões esperando (total, por tipo, 3 mais urgentes) e leva ao Aprovar; filtra pelo projeto do topo
- [x] Hoje traz "Dinheiro por projeto" (o quadro de vendas do Dashboard), recolhido
- [x] Login e barra do celular abrem no Hoje; o Dashboard continua existindo no Laboratório (nada apagado)
- [ ] Arquivar telas sem uso: só depois de ~30 dias de `imphq_page_views` e com a lista aprovada pelo Vinicius

## File List
- `supabase/functions/_shared/approval-queue.ts` — origens `suporte` e `leva`, ordem da fila
- `supabase/functions/_shared/approval-decide.ts` — decisões, `parseSupportId`, `decideLeva`/`updateSupport` no store
- `supabase/functions/_shared/approval-rows.ts` — `supportRows`
- `supabase/functions/_shared/autonomy.ts` — regras `leva:*` e `suporte:*`
- `supabase/functions/project-mcp/index.ts` — fila e decisão no MCP
- `supabase/migrations/20261015_imphq_jp_support_inbox.sql` — RLS de leitura/atualização para admins
- `src/hooks/useApprovals.ts`, `src/hooks/useSidebarBadges.ts`, `src/pages/Aprovar.tsx`
- `src/components/hoje/DecisionsSummary.tsx`, `src/pages/Hoje.tsx`, `src/pages/Login.tsx`, `src/components/mobile/MobileBottomNav.tsx`
- Testes: `src/test/aprovar-leva-suporte.test.ts`, `src/test/hoje-decisoes.test.tsx`, `src/test/hoje.test.tsx`

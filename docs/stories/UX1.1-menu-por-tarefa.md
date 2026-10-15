# Story UX1.1 — Menu por tarefa, projeto global, Laboratório e medição de uso

**Status:** Done · **Data:** 2026-10-15 · Fase 1 da reorganização (nada apagado)

## Contexto
O Império tinha 41 itens no menu, 103 rotas, 101 páginas e 234 funções; 97 tabelas nunca receberam dado e 57 estão
paradas há 30+ dias. Funções de criativos espalhadas, decisões espalhadas e nenhuma medição de uso das telas.

## Critérios de aceite
- [x] `src/lib/navigation.ts`: menu por tarefa (Dia a dia · Projetos · Criativos · Dinheiro · Sistema), 26 itens no lugar de 41
- [x] Laboratório (`/laboratorio`): as 18 telas que saíram do menu, com motivo, uso de 30 dias e estrela para fixar nos favoritos; rotas continuam no ar
- [x] Ações rápidas (⌘J) com "Ir para" de todas as telas (menu + Laboratório)
- [x] Seletor de projeto no topo: usa o `useGlobalProject` criado em paralelo (54e7a94f), sem duplicar; Elenco, Próxima leva e Mineração ligados a ele
- [x] Medição de uso: `imphq_page_views` (rota normalizada, quem, quando) + `imphq_page_usage(dias)`; registro a cada tela aberta, sem repetir em 30 s
- [x] Testes: `navigation.test.tsx` (rotas existem, sem repetição, rota normalizada, projeto compartilhado, ⌘J)

## Próximo (fases 2 e 3)
Projeto como centro (abas) e página Criativos com fluxo guiado; Hoje e Aprovar unificados; com 30 dias de uso, lista do
que arquivar de vez (aprovação do Vinicius antes de apagar qualquer coisa).

## File List
- src/lib/navigation.ts, src/components/AppSidebar.tsx, src/components/AppLayout.tsx, src/components/CommandPalette.tsx
- src/hooks/usePageViewTracking.ts
- src/pages/Laboratorio.tsx, src/App.tsx, src/integrations/supabase/types.ts
- src/components/studio/CastTab.tsx, src/components/testes/NextBatchPanel.tsx, src/components/estrategias/MiningSources.tsx
- supabase/migrations/20261015_imphq_page_views.sql
- src/test/navigation.test.tsx

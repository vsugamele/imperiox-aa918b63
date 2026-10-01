# Story MAP2.1 — Tela Hoje e mapas operacionais (SlimSoda e JP)

Pedido (01/10/2026): finalizar o mapa, o visual e os fluxos para operar no dia a dia. Decisões do Vinicius: mapas completos de SlimSoda e JP; tela "Hoje" como entrada; limpeza a meu critério; eu assumo o mapa (a outra frente não segue em paralelo). Segurança fica para o fim, quando o app estiver pronto.

## Etapa 1 — Tela Hoje
- [x] Regra única da etapa em `_shared/map-steps.ts` (status pela marcação nas notas ou pela checklist, quem executa agrupado em IA / automático / ferramenta / você, skill, prompt). Testes em `src/test/map-steps.test.ts`.
- [x] Canvas (`CompanyMapCanvas`) usa a mesma leitura/escrita das marcações `[agent_*]`.
- [x] `project-mcp` usa a mesma regra de status nas 3 rotas de etapas; filtro padrão passou a `open` (tudo que não está feito), porque etapa com checklist parcial agora conta como "em andamento".
- [x] `/hoje` é a entrada do app: por projeto, etapas para revisar, esperando você, que a IA pode executar e em andamento; vendas e leads do dia; lacunas críticas do motor do mapa. Mudar status e copiar o prompt direto da lista.
- [x] Link de cada etapa abre o canvas já no mapa e na etapa (`/funis?view=mapa&map=…&node=…`).
- [x] Quadro só usa mapas dedicados a um projeto (o Fluxo Master, com vários projetos, fica fora para não duplicar). Testes em `src/test/today-board.test.ts`.

## Etapa 2 — Mapas
- [x] Cópia de segurança antes de mexer: tabela `imphq_company_map_snapshots` + função `imphq_snapshot_company_map` (JP e SlimSoda salvos em 01/10).
- [x] JP reorganizado em 5 seções (Inteligência, Funil Webinar, Funil X1 e Atendimento, Orgânico, Produtos e Entrega): 25 etapas reposicionadas e enriquecidas (executor, skill, papel, playbook, checklist com o estado real), 4 etapas novas de inteligência (avatar, ângulos, métricas Meta, análise do que vende), bump corrigido para R$ 37. Nada apagado.
- [x] SlimSoda atualizada: venda H&W chegando pelo webhook; checklist de rastreamento por página com o estado real do site no ar.

## Achados que viraram lacuna no mapa
- JP: sincronização do Facebook com erro desde junho (último gasto 19/08); só 34 de 71 vendas com UTM; checkout fora do cadastro em Master Cuts, Cortes Descomplicados, Mentoria, Assinatura e JP Hair Education.
- SlimSoda: PDP e VSL da raiz (`/slimtide-vsl/`) no ar sem tracker do Império; `quiz-slimsoda.html` dá 404.

## Etapa 3 — Status e canvas ligados
- [x] Detalhe do projeto em `/mapa` abre o mapa de operação dele (ou leva a montar um) e o Hoje.
- [x] Canvas abre no mapa mexido mais recentemente quando nenhum é pedido.

## Etapa 4 — Limpeza
- [x] Coluna `imphq_company_maps.archived_at`: mapa arquivado some da lista sem apagar nada.
- [x] Arquivados (01/10): EQUILIBREON (vazio), Referencias (vazio), Inteligencia Artificial (1 etapa), Redes Sociais (5), Igaming (3). Para voltar: limpar `archived_at`.
- [x] Fora do menu (rotas seguem no ar): Cockpit Tri-Modo, Master Redesign, Custos IA · Chat.
- [x] Testes: `src/test/hoje.test.tsx` e link do mapa em `src/test/mapa-empresa.test.tsx`.

## File List
- supabase/functions/_shared/map-steps.ts
- supabase/functions/project-mcp/index.ts
- supabase/migrations/20261001_imphq_company_map_snapshots.sql
- src/lib/today-board.ts
- src/hooks/useTodayBoard.ts
- src/pages/Hoje.tsx
- src/components/mapa/Stat.tsx
- src/pages/MapaEmpresa.tsx
- src/pages/Funis.tsx
- src/components/funis/CompanyMapCanvas.tsx
- src/components/AppSidebar.tsx
- src/App.tsx
- src/test/map-steps.test.ts
- src/test/today-board.test.ts
- src/test/hoje.test.tsx
- src/test/mapa-empresa.test.tsx
- src/components/mapa/ProjectMapDetail.tsx
- src/components/empresa/AddAccountToMapDialog.tsx
- src/integrations/supabase/types.ts
- supabase/migrations/20261001_imphq_company_maps_archived_at.sql
- docs/stories/MAP2.1-tela-hoje-e-mapas-operacionais.md

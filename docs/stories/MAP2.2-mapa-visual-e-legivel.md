# Story MAP2.2 — Mapa bonito, claro e legível para pessoas e IAs

Pedido (01/10/2026): melhorar o desenho dos mapas, fluxo, imagens e prints, deixando cada etapa clara para as IAs. Decisões do Vinicius: fazer tudo nesta ordem; os contratos das etapas eu preencho sem revisão prévia.

## 1. Cartão de etapa novo
- [x] Cartão extraído do canvas para `src/components/funis/MapNodeCard.tsx` (modelo em `map-node-model.ts`); canvas caiu de 3.919 para ~3.530 linhas.
- [x] Ordem de leitura: número da etapa, tipo, status declarado → título (15px) e papel → print → "o que faz" (objetivo do contrato ou 1ª frase da descrição) → quem executa e skill → progresso e o que falta → WhatsApp, indicador e link.
- [x] Fora: selos "não verificado" e o "CADASTRO" piscando; fonte mínima 11px; cores pelos tokens do tema.
- [x] Print aparece em qualquer tipo de etapa (antes só no tipo "imagem").
- [x] Testes: `src/test/map-node-card.test.tsx`.

## 2. Prints automáticos
- [x] Bucket público `map-prints` + campo `print_meta` na etapa (migração `20261001_map_prints.sql`).
- [x] `scripts/map-prints.mjs` (CLI): abre cada URL de etapa com Playwright, print de computador (1366×900) e celular (iPhone 13), bloqueando pixel/CAPI/trackers, envia ao Storage e liga à etapa. `--map`, `--node`, `--dry-run`. Fecha o convite do Instagram antes do print.
- [x] `image_url` só recebe o print se estava vazio ou já era o print anterior (imagem posta à mão fica).
- [x] Rodado em SlimSoda e JP: 15 etapas com print, 0 erro (01/10). O print do quiz mostra o 404 e o da buy page mostra o topo com imagem da Oprah.
- [x] Painel da etapa mostra print de computador e celular, data e o comando para atualizar (`StepPrints.tsx`).

## 3. Fluxo legível
- [x] Numeração automática seguindo as setas (`_shared/map-order.ts`, testes em `src/test/map-order.test.ts`): Kahn com desempate por faixa de cima e esquerda→direita; ciclo destrava pela etapa mais acima; centro do projeto, área e imagem sem número. SlimSoda: 23 etapas numeradas na ordem inteligência → orgânico/X1 → criativos → ads → páginas → checkout → compra → métricas → análise.
- [x] Setas: degrau ortogonal, ponta de flecha, sem brilho, animação só na simulação, rótulo com fundo do tema.
- [x] Modo apresentação: tela cheia só com o mapa, nome, total de etapas e Sair (Esc); sem barras, paleta e minimapa. Exportar PNG já existia.
- [x] Cartão de etapa com altura pelo conteúdo (print não fica espremido); tamanho só é gravado quando a pessoa termina de redimensionar (antes a medição automática regravava todas as etapas ao abrir o mapa).
- [x] Seções de SlimSoda e JP com 580px e 640px de passo; etapas do JP de volta às seções depois de um "Organizar" às 20:03 de 01/10 (cópias em `imphq_company_map_snapshots`). 0 cartões sobrepostos.

## 3b. Barra do canvas enxuta (pedido de 01/10)
- [x] À vista: mapa atual, Novo, Apresentar, Organizar, Checklist (feito/total) e Exportar (PNG, JSON, link público, revogar link).
- [x] Menu "Mais" em 4 grupos: Criar (Desenhar com IA, modelo, gerar do negócio, gerar de projeto), Adicionar ao mapa (Reel, Cronograma), Ferramentas (Flow Brain, Infra), Este mapa (Renomear, Arquivar, Excluir de vez).
- [x] Novo: Arquivar mapa (some da lista sem apagar), ao lado do Excluir.
- [x] Paleta de elementos desceu para baixo das barras (antes cobria os botões).
- [x] "Organizar" saiu da barra: agora é "Reorganizar automaticamente…" em Mais → Este mapa, com confirmação e cópia do mapa (`imphq_snapshot_company_map`) antes de mexer.

## 4. Contrato de cada etapa para as IAs
- [x] Contrato completo nas 52 etapas (SlimSoda 23, JP 29), na descrição, uma seção por linha: O QUÊ, ENTRADA, SAÍDA, PRONTO QUANDO, MÉTRICAS, DEPENDE DE, FREQUÊNCIA, SE FALHAR. Escrito a partir do conteúdo dos mapas, do banco e dos sites; avisos (marca de terceiros, aprovação humana, links que faltam) dentro do contrato. Cópia antes em `imphq_company_map_snapshots`.
- [x] Formato conferido contra o leitor `readStageContract` (`src/test/stage-contract-format.test.ts`); o leitor tira o ponto final de cada seção, sem efeito na leitura.
- [x] Notas do JP com `
` literal convertidas em quebra de linha.
- [x] `get_executable_steps` (MCP) devolve as etapas já na ordem do fluxo (`step_number`), com `stage_role`, contrato e `print` (desktop, mobile, data). Publicado; teste do transporte em `src/test/map-agent-status-mcp.test.ts`.

## File List
- src/components/funis/MapNodeCard.tsx
- src/components/funis/map-node-model.ts
- src/components/funis/CompanyMapCanvas.tsx
- src/test/map-node-card.test.tsx
- src/components/funis/StepPrints.tsx
- scripts/map-prints.mjs
- supabase/migrations/20261001_map_prints.sql
- src/integrations/supabase/types.ts
- .gitignore
- supabase/functions/_shared/map-order.ts
- src/test/map-order.test.ts
- src/test/stage-contract-format.test.ts
- src/test/map-agent-status-mcp.test.ts
- supabase/functions/project-mcp/index.ts
- docs/stories/MAP2.2-mapa-visual-e-legivel.md

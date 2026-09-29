# Story MAP1.1 — Mapa da Empresa (fase 1: leitura)

Pedido: o Império HQ existe para organizar projetos, produtos, avatares, concorrentes, funis e links de forma que humanos e IAs leiam a mesma coisa, identifiquem lacunas e operem com o máximo de autonomia. Hoje cada tela (Raio-X, Mapa Operacional, Ativos Mestres) e o MCP calculam "o que falta" de um jeito diferente, sobre dados em 4 formatos distintos, com valores fixos enganosos (ex.: preço "R$ 47,00" e links do JP usados como padrão para outros projetos).

Fase 1 = uma regra única de leitura, sem migrar o banco. Fase 2 (story futura) = tabelas próprias para o que o uso mostrar necessário.

## Critérios de aceite
- [x] Motor único `buildProjectMap` (TS puro, sem dependências) em `supabase/functions/_shared/project-map.ts`, importável pelo frontend (`@shared/project-map`) e pelas edge functions.
- [x] Lê os 4 formatos atuais de `imphq_projects` (legado rico, padrão novo, produto único, quase vazio) sem valores inventados.
- [x] Áreas: Produtos/Ofertas, Avatar, Mecanismo, Concorrentes, Funil, Ativos (VSL, copy, criativos), Atendimento (WhatsApp/IA).
- [x] Status por item: Falta → Desenhado → Construído → Rodando (e Pausado para produtos inativos), sempre com a evidência que justifica o status.
- [x] Lista de lacunas priorizada (crítica / importante / sugestão) com ação e skill sugeridas.
- [x] Testes cobrindo os 4 formatos de dados e os problemas de cadastro vistos no JP (duplicidade, campo legado conflitante, "concorrentes" que são anotações, chip inativo com tráfego, taxa de resposta).
- [x] Tela "Mapa da Empresa" (`/mapa`): matriz projetos × áreas, filtro de lacunas críticas, detalhe por projeto; versão em cartões no celular.
- [x] Ferramenta MCP `get_project_map` usando o mesmo motor (código pronto).
- [x] Deploy da `project-mcp` (29/09, junto com a chave de acesso do MCP; `get_project_map` verificada em produção).
- [x] Validação visual com dados reais logado (12 projetos; corrigido falso positivo de vendas por nome parecido).
- [x] lint + typecheck + test (418) + build verdes.

## Achados nos dados reais (para decisão)
- JP Freitas: campos de produto único de um modelo fitness ("Curso Fitness / Emagrecimento", R$ 997; avatar.externo e avatar.mecanismo sobre emagrecimento) convivem com o cadastro real.
- JP Freitas: 22 "concorrentes", vários são anotações de importação ("O mercado está em transição", "Busca Google — ...").
- JP Freitas: produto duplicado (Código dos Cortes Perfeitos) e nenhum link de checkout cadastrado, apesar de vender.
- Chips `jpfreitas` e `suportejpoficial` com `is_active=false` / "connecting" enquanto mensagens chegam.
- WhatsApp JP: ~5–15% de respostas registradas por mensagem recebida em todos os dias da última semana.

## Fora do escopo
- Migração de dados/tabelas (fase 2).
- Remover telas antigas e `get_project_readiness` (decisão posterior, com confirmação).

## File List
- docs/stories/MAP1.1-mapa-da-empresa-leitura.md
- supabase/functions/_shared/project-map.ts
- supabase/functions/project-mcp/index.ts
- src/hooks/useCompanyMap.ts
- src/pages/MapaEmpresa.tsx
- src/components/mapa/map-styles.ts
- src/components/mapa/StatusPill.tsx
- src/components/mapa/ProjectMapDetail.tsx
- src/App.tsx
- src/components/AppSidebar.tsx
- src/test/project-map.test.ts
- src/test/mapa-empresa.test.tsx
- vite.config.ts, vitest.config.ts, tsconfig.app.json (alias `@shared`)

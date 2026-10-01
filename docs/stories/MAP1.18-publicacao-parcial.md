# Story MAP1.18 — Release parcial de jornadas e status

Publicação autorizada pelo usuário nesta conversa em 01/10/2026. Base origin/main 754e8fca; branch codex/map-release-partial.

## Escopo
Clareza de jornadas e pendências por oferta em /mapa e leitura nativa de status no editor existente. Compartilhar motores offer-journey/map-contract/project-map entre UI e leitor project-mcp. Sem piloto DEV, biblioteca nova, alteração de cadastros, prints locais, scheduler, fábrica, mensagem, compra ou gasto.

## Plano
1. Reutilizar o motor testado e adaptar somente os pontos de entrada nativos.
2. Corrigir tipagem herdada de briefing para o gate de lint; não publicar/executar essa função.
3. Validar gates e diff; DevOps publica SHA exato via PR e merge normal, sem force.

Não chamar prova de execução a checklist/status/URL. Ausência de vínculo não prova inexistência; grupo/ascensão têm aplicabilidade a confirmar. Oferta pausada permanece pausada. Não mudar permissões/auth/mutadores. Identidades, IDs, posições, conexões e dimensões preservadas.

- [x] Pacote implementado e revisão independente.
- [x] Lint/typecheck/test/build completos.
- [ ] Commit e PR pelo fluxo DevOps.
- [ ] SHA publicado e deploy READY verificados.
- [ ] Paridade leitor remoto e limitação visual registradas.

## File List
- src/components/funis/CompanyMapCanvas.tsx
- src/components/funis/map-agent-data.ts
- src/components/mapa/ProjectMapDetail.tsx
- src/components/mapa/OfferJourneys.tsx
- src/components/shared/ImageLightbox.tsx
- src/hooks/useCompanyMap.ts
- src/test/project-map.test.ts
- src/test/project-map-detail.test.tsx
- src/test/offer-journey.test.ts
- src/test/offer-journeys.test.tsx
- src/test/map-agent-data.test.ts
- src/test/map-agent-status-mcp.test.ts
- supabase/functions/_shared/project-map.ts
- supabase/functions/_shared/map-contract.ts
- supabase/functions/_shared/offer-journey.ts
- supabase/functions/project-mcp/index.ts
- supabase/functions/daily-briefing-wa/index.ts (somente tipos; fora do deploy Edge)
- docs/stories/MAP1.18-publicacao-parcial.md

## Evidências locais e limites
01/10/2026: npm run lint passou, zero erros e dois avisos herdados em arquivos não alterados; npm run typecheck passou; npm test passou (462 testes/68 arquivos); npm run build passou, com avisos de chunks/importação mista existentes. git diff --check passou.

Revisão independente QA encontrou URLs com credenciais/parâmetros sensíveis, papel explícito obrigado contado como checkout e pausa descartada no objeto legado. Corrigidos na projeção compartilhada, com testes de regressão; regras de pontuação restantes preservadas. Filtro de parâmetros conhecidos não é garantia de anonimização de todo conteúdo arbitrário. Registros originais permanecem intactos.

Teste de transporte MCP valida os três caminhos de leitura e rejeição 401 antes de ler dados; serviço continua administrativo global para chaves autorizadas, sem ampliar permissões. Código remoto anterior project-mcp v20 e seus cinco módulos coincidem com a base 754e8fca. Comparação independente do JavaScript emitido confirmou briefing idêntico; nenhuma execução/deploy desta função autorizado neste pacote.

Teste do detalhe nativo confirma troca de projeto, pendências por oferta e ausência de mutação. Captura só usa image_url já registrado e URL de página exata; origem/data/autenticidade ainda a conferir, falha da imagem aparece como indisponível. Não promove prints do piloto. Aba pública abriu /login: sem prova visual do mapa autenticado nesta sessão. Resultado de build não equivale a essa prova.

Publicar apenas frontend pelo Git/Vercel e project-mcp pelo conector; não executar deploy geral de funções. Nenhuma migração, tarefa/scheduler, configuração de agente, compra, mensagem ou alteração de acesso.

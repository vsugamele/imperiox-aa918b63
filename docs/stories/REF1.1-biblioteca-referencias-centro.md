# Story REF1.1 — Biblioteca de referências analisadas (vindas do Centro de Comando)

Pedido (04/10/2026): puxar as referências do Centro de Comando (imperio-centro-comando.vercel.app, repo `vsugamele/automacao-de-postagem`, pasta `dashboard/`) para o Império, no padrão de lá. Decisões do Vinicius: dados + quadros copiados, vídeo por link temporário; carga única (a mineração passa a ser do Império); uso da chave de serviço do Centro só dentro do script de carga.

Fonte: Supabase `sxiqbhcnkzrrenzgncss` (mesmo do AffHub), tabela `automacao_postagem_content_references` (`metadata.library`), bucket privado `automacao-postagem-library` (105 vídeos, 1,07 GB; 3.336 imagens), ficha editorial em `dashboard/src/data/reference-editorial*.json` (48 fichas).

## Feito (04/10/2026)
- [x] `imphq_referencias` ganhou `fonte`, `external_id` (único), `lote`, `duracao`, `quadros`, `analise`, `video_ref`; bucket público `reference-frames`. Migração `20261004_imphq_referencias_biblioteca.sql`, aplicada.
- [x] Script `scripts/import-centro-references.mjs` (`--dry-run`, `--only N`): lê a chave do `.env.local` do Centro sem mostrar; copia os 6 quadros que a análise usa por referência; grava análise completa (anatomia, transcrição, método, consciência, ângulo, troca de crença, nota de qualidade, prompt de replicação, ficha editorial) e a referência do vídeo. Validado com 1 referência antes das 105.
- [x] Function `reference-video-url` (publicada): link de 15 min do vídeo no bucket do Centro, só para usuário logado (a chave pública sozinha recebe 401).
- [x] `/referencias` ganhou o seletor **Todas | Biblioteca analisada** (`ReferenceLibraryView`): busca, nicho, lote, quadros com tempo, "Assistir ao vídeo", "Link da referência", ficha editorial (Tema, Público, Estrutura, Entrega, CTA, Crítica, O que aproveitar) e "Examinar análise" (anatomia, análise, prompt, transcrição).

## Pendente
- [ ] Vinicius: gravar `CENTRO_SUPABASE_URL` e `CENTRO_SERVICE_ROLE_KEY` como secrets do Império (sem isso o vídeo responde "indisponível").
- [ ] Conferência visual logado.
- [ ] Mineração de novas referências pelo próprio Império (próxima etapa definida pelo Vinicius).

## File List
- supabase/migrations/20261004_imphq_referencias_biblioteca.sql
- scripts/import-centro-references.mjs
- supabase/functions/reference-video-url/index.ts
- src/components/referencias/ReferenceLibraryView.tsx
- src/pages/Referencias.tsx
- src/test/centro-imports-views.test.tsx
- .gitignore

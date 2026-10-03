# LAUNCH1.2 — Playbook YouTube (vídeos longos + Shorts)

**Status:** Done (03/10/2026) · Épico: `EPIC-LAUNCH1-lancador-de-projetos.md`

## Acceptance Criteria
- [x] Playbook `youtube-canal` (família orgânico, 12 etapas): referências e outliers, avatar, posicionamento, canal verificado, banco de ideias por palavra-chave, título e thumbnail antes do roteiro, roteiro com retenção, produção, publicação e SEO do vídeo (UTM), Shorts derivados, destino do canal (captura/oferta/X1), análise semanal
- [x] Riscos de política: conteúdo em massa/inautêntico, nichos de dinheiro e saúde (sem promessa), direitos autorais, engajamento comprado
- [x] Métricas novas: `youtube_views`, `youtube_ctr`, `youtube_retencao`, `youtube_inscritos` (fonte YouTube Analytics API, ainda sem conexão)
- [x] Canal `youtube` do kit (LAUNCH1.1) aponta para o playbook; teste garante que todo playbook de canal existe na biblioteca
- [x] Biblioteca gravada no banco (9 playbooks); testes da biblioteca e do kit verdes

## File List
- `supabase/functions/_shared/playbook-library.ts`, `supabase/functions/_shared/metric-keys.ts`
- `src/test/launch-kit.test.ts`

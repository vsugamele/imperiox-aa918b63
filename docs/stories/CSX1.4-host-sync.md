# CSX1.4 — Sincronizar Império Lovable/Vercel

1. Integrar commits Cinna com main atual e publicar ambos (aprovado).
2. Manter hosts divergentes (rejeitado).
3. Usar somente Vercel (não corresponde ao acesso habitual).

Arquitetura: mesmo repositório atualizado, mesmo Supabase, publicações independentes. Card nativo em OpenFlow consulta configuração real na Edge existente e abre o editor; não cria automação paralela ou habilita envio. Preservar 44 commits remotos, incluindo lazyWithRetry e otimizações.

- [x] Identificar Lovable ccdd4ec8-7dd5-462a-ac41-f99ba5b00a59 / imperiox.lovable.app.
- [x] Integrar 3 commits em worktree isolado preservando atualizações remotas.
- [x] Adicionar card nativo ligado à configuração real.
- [x] Executar gates e revisão devops (lint global bloqueado por 5053 erros legados idênticos ao baseline).
- [ ] Sincronizar GitHub e publicar Lovable/Vercel.
- [ ] Conferir card e conversa autenticada no endereço habitual.

File List: src/components/openflow/CinnaCloudFlowCard.tsx; src/pages/OpenFlow.tsx; docs/stories/CSX1.4-host-sync.md; package-lock.json; docs/sessions/2026-09/cinna-host-sync.md.

## Diagnóstico

As três rotas (`/gerenciador`, `/cohort`, `/recuperacao`) **estão** corretamente registradas em `src/App.tsx` (linhas 89-91), os arquivos `src/pages/Gerenciador.tsx`, `Cohort.tsx` e `Recuperacao.tsx` existem, e o sidebar `AppSidebar.tsx` aponta para elas.

O 404 que você vê é o `NotFound.tsx` do React Router — ou seja, o app carregou, mas o router atual não reconhece esses paths. Isso só acontece se o navegador estiver executando um **bundle JS antigo** (anterior à adição dessas rotas), servido pelo Service Worker do PWA.

Confere com o histórico: ontem mexemos pesado no `creative-factory`, `ProjetoDetalhe`, `SalesPathButton` etc. — o SW provavelmente cacheou o `index.html` + chunks antigos antes do último deploy.

## Plano de correção

### Passo 1 — Verificar via browser tools (sem código)
Abrir o preview, inspecionar:
- Se o Service Worker está registrado e qual versão
- Console: erro de chunk load / "Failed to fetch dynamically imported module"
- Network: confirmar se `App.tsx` bundle vem do cache ou do servidor

### Passo 2 — Forçar bump de versão do SW
Em `public/sw-push.js` (e qualquer registro do Workbox), incrementar o `CACHE_VERSION` / `revision` para invalidar caches existentes e forçar `skipWaiting` + `clients.claim` no install/activate. Isso garante que usuários com PWA instalado recebam o novo bundle no próximo load.

### Passo 3 — Adicionar rotas ao precache allow-list (se aplicável)
Confirmar que `/gerenciador`, `/cohort`, `/recuperacao` não estão sendo bloqueados pelo `navigateFallbackDenylist` do Workbox.

### Passo 4 — Instrução ao usuário
Enquanto o novo SW não ativa: **hard refresh** (Ctrl+Shift+R) ou DevTools → Application → Service Workers → "Unregister" + Clear storage. Em produção (`imperiox.lovable.app`) o novo SW assume sozinho na próxima visita após o deploy.

## Detalhes técnicos

- Arquivos a inspecionar: `public/sw-push.js`, `vite.config.ts` (config do VitePWA/Workbox), `src/main.tsx` (registro do SW)
- Arquivos a editar: provavelmente só `public/sw-push.js` ou config do Workbox para bump de versão
- Não tocar em `App.tsx` nem nas páginas — estão corretos

## O que NÃO vou fazer
- Recriar as páginas (já existem e funcionam)
- Mexer no sidebar (correto)
- Adicionar rotas (já estão lá)

Aprova que eu siga investigando o SW e aplique o bump de versão?
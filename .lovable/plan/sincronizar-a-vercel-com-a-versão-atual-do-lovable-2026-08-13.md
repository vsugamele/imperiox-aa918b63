# Sincronizar a Vercel com a versão atual do Lovable

## Passo 0 — destravar o build (obrigatório antes de qualquer deploy)

Existem 2 erros de TypeScript em `src/pages/LinfaFlowCareRoom.tsx` (linhas 692 e 727): o campo `kind` dos anexos está sendo inferido como `string` em vez de `"image" | "audio"`, então `setAttachments` rejeita o valor. Enquanto isso existir, o build da Vercel falha e nenhum deploy novo sobe — o que por si só já explicaria a Vercel estar atrasada.

Correção: tipar explicitamente (`const kind: LeadAttachment["kind"] | null = ...`) e anotar o array literal como `LeadAttachment[]` nos dois `setAttachments`. Sem mudança de comportamento.

## Contexto

O Lovable serve o código do projeto direto (preview instantâneo, publish em segundos). A Vercel só atualiza quando recebe um push no repositório Git e roda o próprio build. Se o repo não está recebendo os commits — ou o build falhou / aponta para outro branch — a Vercel continua servindo uma versão antiga. Cache de CDN + service worker (PWA) podem manter o bundle velho mesmo após um deploy correto.

Não posso executar comandos de Git nem acessar o painel da Vercel daqui, então a sincronização tem uma parte sua (2 cliques) e uma parte minha (código que evita o problema voltar).

## O que você faz (rápido)

1. No Lovable: **GitHub → confirmar que o repositório está conectado e sincronizando** (Project settings → GitHub). Se estiver desconectado, reconectar é o que resolve 90% dos casos.
2. Na Vercel → projeto → **Deployments**: olhar o último deploy.
   - Se estiver **Error**: abrir o log e me mandar as últimas linhas.
   - Se estiver **Ready mas antigo**: clicar em **Redeploy** com "Use existing Build Cache" **desmarcado**.
3. Na Vercel → **Settings → Git**: conferir se o *Production Branch* é o mesmo branch que o Lovable usa (normalmente `main`).

## O que eu faço no código

1. **Marcador de versão visível** — injetar no build (via `vite.config.ts` + `index.html` meta) a data/hash do build e expor em `window.__APP_BUILD__`. Assim dá para abrir o site da Vercel, olhar 1 valor e saber na hora se é a versão nova ou cache antigo — sem adivinhação.
2. **Headers anti-cache na Vercel** — adicionar em `vercel.json` headers para `index.html`, `/sw-push.js` e `/manifest.json` com `Cache-Control: no-cache`, mantendo `/assets/*` imutável (hash no nome). Hoje o `vercel.json` só tem o rewrite de SPA, então o HTML pode ficar preso em cache de CDN/browser.
3. **Guardas de service worker** — o `src/main.tsx` já desregistra SW no preview e já recupera erro de chunk obsoleto. Vou estender a detecção de host de preview para também tratar `*.vercel.app` como ambiente onde o SW não deve segurar bundle antigo, e forçar `updateViaCache: 'none'` no registro em produção.

## Detalhes técnicos

- `vite.config.ts`: `define: { __BUILD_ID__: JSON.stringify(new Date().toISOString()) }` + tipagem em `src/vite-env.d.ts`.
- `vercel.json`: bloco `headers` — `source: "/index.html"` e `source: "/sw-push.js"` → `no-cache, no-store, must-revalidate`; `source: "/assets/(.*)"` → `public, max-age=31536000, immutable`.
- `src/main.tsx`: `navigator.serviceWorker.register("/sw-push.js", { scope: "/", updateViaCache: "none" })`.
- Nada de backend muda; nenhuma migração.

## Resultado

Depois disso: um push/redeploy na Vercel passa a refletir a versão atual, e você consegue verificar em 5 segundos qual build está no ar em cada domínio (Lovable vs Vercel).

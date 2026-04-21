

## Fix: Notificações Push não chegam no smartphone

### Causa raiz (3 bugs combinados)

**1. Service Worker não tem listener `push`**
O VitePWA gera um SW (Workbox) só pra cache offline — ele **não escuta o evento `push`**. Quando o servidor envia push, o navegador recebe, mas como o SW não trata, **nada aparece na tela**. Esse é o bug principal.

**2. `send-push` envia payload sem criptografia VAPID**
A função em `supabase/functions/send-push/index.ts` faz um `fetch` direto pro endpoint do FCM/Apple com `body: JSON.stringify(...)`. Web Push **exige criptografia ECDH (aes128gcm) + JWT VAPID assinado** no header `Authorization`. Sem isso, FCM responde **401/400** e descarta a mensagem. Os logs mostram função sendo chamada mas sem confirmação de entrega.

**3. `applicationServerKey` em formato errado**
`PushOptIn.tsx` passa `vapidKey` como **string base64 crua** pro `pushManager.subscribe`. A API exige **Uint8Array** (base64-url decoded). No Chrome Android isso falha silenciosamente ou gera subscription inválida.

**Bônus:** `VITE_VAPID_PUBLIC_KEY` provavelmente nem está no `.env`, e os secrets `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` não existem no Supabase.

### Solução

**a) Criar Service Worker customizado** `public/sw-push.js`
- Listener `push`: lê payload JSON, chama `self.registration.showNotification(title, { body, icon, badge, data })`
- Listener `notificationclick`: foca/abre janela do app na URL do payload
- Registrar via `injectManifest` no `vite.config.ts` (substitui o `generateSW` do Workbox), preservando cache + denylist `/~oauth`

**b) Reescrever `supabase/functions/send-push/index.ts`** com Web Push real
- Usar `npm:web-push@3.6` (compatível com Deno via `npm:` specifier)
- `webpush.setVapidDetails(subject, public, private)`
- `webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload)`
- Tratar `410/404` → deletar subscription (já existe)
- Tratar erros 401/403 → log claro pra debug

**c) Corrigir `PushOptIn.tsx`**
- Adicionar `urlBase64ToUint8Array(vapidKey)` antes de passar pro `subscribe`
- Validar permissão em iOS PWA (Safari só permite push depois de "Add to Home Screen" + usuário abrir o app instalado)

**d) Configurar secrets**
- Gerar par VAPID (script Node ou via web-push CLI) → adicionar no Supabase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto)
- Adicionar `VITE_VAPID_PUBLIC_KEY` no `.env` (mesma chave pública)
- Avisar usuário pra **revogar e re-assinar** push em todos dispositivos (subscriptions antigas ficam órfãs)

**e) Testar**
- Botão "Testar push" em Configurações → chama `send-push` com `user_id` próprio
- Verificar logs `send-push` mostrando `201 Created` do FCM/Apple

### Detalhes técnicos
- **iOS**: push só funciona se PWA estiver **instalado via "Add to Home Screen"** (Safari 16.4+). Web push em browser comum no iOS **não existe**.
- **Android Chrome**: funciona em browser e PWA instalado.
- Manter guard de iframe/preview existente (já correto).
- Sem migrations — tabela `imphq_push_subscriptions` já está OK.

### Fora de escopo
- Push agendado/recorrente
- Notification grouping/badges complexos
- Suporte a SMS fallback


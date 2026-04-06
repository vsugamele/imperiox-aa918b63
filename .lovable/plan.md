

# Plano: Aba Qualificacao Enriquecida + PWA com Push

2 blocos restantes do plano aprovado.

---

## 1. Enriquecer aba Qualificacao no Lead Detail (Leads.tsx)

A aba "Qualificacao" (linhas 1376-1385) hoje so tem campos manuais (dor principal, nivel consciencia, renda, canal, objecoes, notas). Precisa exibir os dados automaticos que agora existem no backend.

### Mudancas

**Ao abrir o lead (`loadTimeline`)**: buscar tambem:
- `imphq_lead_scores_log` filtrado por `lead_id` — para mostrar breakdown de pontos
- `imphq_lead_responses` filtrado por `lead_id` — para mostrar respostas de formularios
- Extrair `interacoes` do `lead.data` — para mostrar historico acumulado

**Na aba Qualificacao, adicionar 4 secoes automaticas ANTES dos campos manuais**:

1. **Score Detalhado** — barra de progresso com score total + lista de pontos ganhos (acao + pontos + data)
2. **Respostas de Formularios** — agrupadas por form_id, exibindo question + answer
3. **Historico de Interacoes** — lista do array `data.interacoes` com evento, produto, valor, tipo_venda (badges), UTMs, data
4. **Compras com Tipo** — na secao de vendas existente (linha 1347), adicionar badge de `tipo_venda` (Order Bump, Upsell, Downsell) buscando da venda

**Estado adicional**:
- `scoreLog: {acao: string, pontos: number, created_at: string}[]`
- `formResponses: {form_id: string, question: string, answer: string, created_at: string}[]`

### Arquivo
`src/pages/Leads.tsx` — ~80 linhas adicionadas na aba qualificacao + ~15 linhas no loadTimeline

---

## 2. PWA com Push Notifications

### 2.1 Instalar vite-plugin-pwa + configurar

**`vite.config.ts`**: adicionar `VitePWA` com:
- `registerType: "autoUpdate"`
- `devOptions: { enabled: false }`
- `workbox.navigateFallbackDenylist: [/^\/~oauth/]`
- `manifest: false` (usar o manifest.json existente)

### 2.2 Guard no main.tsx

**`src/main.tsx`**: adicionar guard que:
- Detecta iframe ou dominio de preview
- Unregistra SWs existentes nesses contextos
- So permite registro em producao

### 2.3 Edge function send-push

**`supabase/functions/send-push/index.ts`**: nova funcao que:
- Recebe `{ user_id, title, message }`
- Busca subscriptions do user em `imphq_push_subscriptions`
- Envia via Web Push usando VAPID keys (secrets necessarios: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)

### 2.4 Componente PushOptIn

**`src/components/PushOptIn.tsx`**: botao que:
- Pede `Notification.requestPermission()`
- Registra push subscription via `serviceWorkerRegistration.pushManager.subscribe()`
- Salva endpoint + keys em `imphq_push_subscriptions`
- Mostra estado atual (ativo/inativo)

### 2.5 Integrar no layout

**`src/components/AppLayout.tsx`**: adicionar `<PushOptIn />` ao lado do `<NotificationBell />`

### 2.6 Integrar no notify-scheduler

**`supabase/functions/notify-scheduler/index.ts`**: apos cada `notify()`, chamar `send-push` via fetch interno para enviar push real

### Secrets necessarios
- `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` — o usuario precisa gerar (vou orientar)

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/Leads.tsx` | Enriquecer aba Qualificacao com score log, form responses, interacoes, badges tipo_venda |
| `vite.config.ts` | Adicionar VitePWA plugin |
| `src/main.tsx` | Guard iframe/preview + unregister SW |
| `supabase/functions/send-push/index.ts` | Nova edge function Web Push |
| `src/components/PushOptIn.tsx` | Novo componente opt-in push |
| `src/components/AppLayout.tsx` | Adicionar PushOptIn no header |
| `supabase/functions/notify-scheduler/index.ts` | Chamar send-push apos cada notificacao |

## Ordem

1. Aba Qualificacao enriquecida (Leads.tsx)
2. PWA config (vite.config + main.tsx)
3. PushOptIn + AppLayout
4. send-push edge function
5. Integrar no notify-scheduler


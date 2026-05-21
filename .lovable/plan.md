## Objetivo

Substituir o nó `n8n-nodes-instagram-token` por um módulo nativo da ImperioHQ, com token **por projeto** (igual FB/WhatsApp já fazem), suportando DMs, gestão de comentários e webhooks em tempo real. UI tanto em `ProjetoDetalhe → Integrações` quanto em página global `/instagram`.

---

## 1. Banco de dados

**Tabelas novas (`imphq_`):**

- `imphq_ig_accounts` — uma linha por projeto/conta conectada
  - `id uuid pk`, `project_id text fk`, `ig_user_id text` (Business Account ID, auto-discovered), `username text`, `page_id text`, `display_name text`, `status text` (`active|expired|error`), `last_refresh_at timestamptz`, `expires_at timestamptz`, `created_at`, `updated_at`
- `imphq_ig_conversations` — espelho do `imphq_wa_conversations`
  - `id uuid pk`, `account_id uuid fk`, `ig_thread_id text`, `participant_id text`, `participant_username text`, `participant_avatar text`, `last_message text`, `last_message_at timestamptz`, `unread_count int`, `lead_id text fk null`
- `imphq_ig_messages` — `id uuid`, `conversation_id uuid fk`, `direction text` (`in|out`), `type text` (`text|image|audio|video|template|reply`), `content text`, `media_url text`, `mid text` (ID do Meta), `status text`, `created_at`
- `imphq_ig_comments` — `id uuid`, `account_id uuid fk`, `media_id text`, `comment_id text uniq`, `from_username text`, `text text`, `is_hidden bool`, `replied bool`, `created_at`
- `imphq_ig_webhook_logs` — auditoria igual `imphq_webhook_logs`

**Tokens:** vão para `imphq_integration_credentials` com `provider='instagram'` e `project_id` (já temos o padrão — token nunca em JSONB). OAuth state também vai aí.

**RLS:** mesmo padrão de FB Ads — `auth.uid() is not null` para leitura; writes restritos a service role + edge functions.

---

## 2. Edge Functions

| Função | Propósito |
|---|---|
| `instagram-oauth-start` | Gera URL do Facebook Login (scopes: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_messaging`, `pages_show_list`) com `state=<project_id>` |
| `instagram-oauth-callback` | Recebe `code`, troca por short-lived → long-lived (60d), descobre `ig_user_id` via `/me/accounts` + `instagram_business_account`, grava em `imphq_integration_credentials` e `imphq_ig_accounts` |
| `instagram-token-refresh` (cron diário) | Renova tokens com <7d de validade via `/refresh_access_token`; marca `status='expired'` se falhar |
| `instagram-api` | Proxy/roteador único (padrão do `whatsapp-api`). Actions: `send_text`, `send_media`, `send_quick_replies`, `private_reply`, `reply_comment`, `hide_comment`, `unhide_comment`, `delete_comment`, `list_conversations`, `list_messages`, `fetch_account` |
| `instagram-webhook` | `verify_jwt=false`. GET handshake (`hub.challenge`), POST normaliza eventos (`messages`, `messaging_postbacks`, `comments`, `mentions`) e grava em `imphq_ig_messages`/`imphq_ig_comments` + dispara automações |
| `instagram-manual-token` | Valida e salva token colado manualmente (caminho rápido) |

Padrão action routing (query OU body) + corsHeaders + Zod nos inputs, como nas demais.

---

## 3. Token: ambos caminhos

- **Caminho rápido — token manual:** form em `ProjetoDetalhe → Integrações → Instagram`. Cola token long-lived + (opcional) Business Account ID. Salva via `instagram-manual-token`. Auto-refresh ainda funciona se o token foi gerado com `ig_refresh_token` permission.
- **Caminho completo — OAuth:** botão "Conectar com Facebook". Abre popup → `instagram-oauth-start` → callback persiste tudo. Refresh automático via cron.

Usuário escolhe no momento. Mesma tabela, mesmo fluxo a partir daí.

---

## 4. Webhooks

Configurar no Meta App: callback `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/instagram-webhook`, verify token guardado em secret `IG_WEBHOOK_VERIFY_TOKEN`. Subscribe fields: `messages`, `messaging_postbacks`, `comments`, `mentions`.

Eventos disparam:
- Inserção em `imphq_ig_messages` → Realtime atualiza UI
- Lead matching por `participant_username` (cria `imphq_leads` se não existir, igual WhatsApp)
- Hook futuro para automações (envio para `imphq_ai_actions` quando comentário tem palavra-chave)

---

## 5. UI

### A) Aba em `ProjetoDetalhe → Integrações`
Componente `InstagramTab.tsx`:
- Status da conta (conectado/expirado), `@username`, dias até expirar, botão "Renovar agora"
- Toggle entre "Colar token" e "Conectar via Facebook"
- Lista compacta de últimas 5 DMs + 5 comentários
- Link "Abrir Inbox completo →" para `/instagram?project=<id>`

### B) Página global `/instagram` (estilo `/whatsapp`)
- Sidebar esquerda: lista de contas conectadas (filtro por projeto)
- Centro: lista de conversas (DMs) + tab "Comentários"
- Direita: thread ativa com envio de texto/imagem/áudio/vídeo/quick replies
- Tab "Comentários": tabela com responder / ocultar / deletar / private reply
- Filtros persistentes em localStorage (mesmo padrão do v2 WhatsApp)

Rota adicionada em `App.tsx` + item no `AppSidebar.tsx` (ícone Instagram).

---

## 6. Secrets necessários

- `META_APP_ID` (público, mas guardado por consistência)
- `META_APP_SECRET`
- `IG_WEBHOOK_VERIFY_TOKEN` (gerado por nós; usuário cola no Meta App)

A primeira vez pedirei via `add_secret`.

---

## 7. Entregas em ordem

1. Migração SQL (5 tabelas + RLS + índices)
2. Edge Functions na ordem: `instagram-manual-token` → `instagram-api` (send_text + list) → `instagram-webhook` → `instagram-oauth-start/callback` → `instagram-token-refresh` (cron)
3. UI: `InstagramTab.tsx` no ProjetoDetalhe (MVP)
4. Página `/instagram` completa (inbox DMs + comentários)
5. Memória do projeto: salvar arquitetura em `mem://features/instagram/architecture`

---

## Fora de escopo (deixar pra depois)

- Publicação de feed/reels/stories (você só marcou DMs + comentários + webhooks)
- Templates botão/carrossel (raramente usado em IG, podemos adicionar se precisar)
- Analytics de insights de mídia

Confirma que sigo nessa ordem?
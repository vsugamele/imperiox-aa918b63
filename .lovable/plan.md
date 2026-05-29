# Meta WhatsApp Cloud API nativa + Guia Evolution

## 1. Banco (migration)

Adicionar suporte ao provider `meta_cloud` em `imphq_wa_providers`:

```sql
ALTER TABLE public.imphq_wa_providers
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS waba_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verify_token TEXT;
```

(O `provider` já é TEXT livre — passa a aceitar `'meta_cloud'`.)

## 2. Edge Functions

### `whatsapp-api` (já existe — estender)
- Adicionar branch `provider === 'meta_cloud'` em `send_message`:
  - `POST https://graph.facebook.com/v20.0/{phone_number_id}/messages`
  - Header `Authorization: Bearer {access_token}`
  - Body `{ messaging_product:'whatsapp', to, type:'text', text:{body} }`
- Webhook GET (verificação): se `hub.mode=subscribe` e `hub.verify_token` bate → retorna `hub.challenge`.
- Webhook POST: parsear `entry[].changes[].value.messages[]` e normalizar para o mesmo formato dos eventos Evolution (`MESSAGES_UPSERT`) → grava em `imphq_wa_messages`.

### URL do webhook que o usuário vai colar na Meta
```
https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/whatsapp-api?provider=meta_cloud&project={PROJECT_ID}
```

## 3. Frontend

### `ProviderConfigDialog.tsx`
- Adicionar opção `Meta Cloud API (oficial)` no Select de provider.
- Campos quando `meta_cloud`:
  - `phone_number_id` (ID do número — Meta Business)
  - `waba_id` (WhatsApp Business Account ID)
  - `access_token` (System User token permanente)
  - `webhook_verify_token` (string que o usuário inventa)
  - `display_name` (apelido)

### Novo componente `MetaCloudGuide.tsx`
Passo a passo com 6 etapas + URLs prontas para copiar:
1. Criar app em developers.facebook.com → WhatsApp
2. Pegar `Phone Number ID` e `WABA ID`
3. Gerar System User token permanente (Business Settings)
4. Colar credenciais no dialog
5. Configurar Webhook na Meta com a URL + verify_token
6. Inscrever no campo `messages`

### Novo componente `EvolutionGuide.tsx`
Passo a passo Evolution (atualmente sem guia):
1. Subir Evolution API (Docker ou Hostinger/Render) ou usar provider SaaS
2. Pegar `API URL` (ex: `https://evo.seudominio.com`) e `API Key` global
3. Criar instância (nome técnico) no painel Evolution
4. Colar URL + Key + nome da instância no dialog
5. Escanear QR Code (botão no WhatsAppPage)
6. Configurar webhook da instância apontando para:
   `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/whatsapp-api/{instance_name}`

Ambos guias acessíveis via tab/aba no `WhatsAppPage` ou botão "Como conectar?" dentro do `ProviderConfigDialog`.

## 4. Memória
Atualizar `mem://tech/whatsapp/provider-resolution-hierarchy` para incluir `meta_cloud` como provider oficial suportado.

---

**Detalhes técnicos:** access_token da Meta fica em `imphq_wa_providers.access_token` (mesma tabela que já guarda `api_key` do Evolution). Os webhooks da Meta não exigem auth — verificação é via `verify_token` por instância. Normalização garante que mensagens recebidas de Meta Cloud e Evolution caem na mesma pipeline (`imphq_wa_messages` + autoresponder).

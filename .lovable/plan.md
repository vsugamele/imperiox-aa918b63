
## Melhorias no WhatsApp (`/whatsapp`)

### 1. Marcador de mensagens não lidas
A tabela `imphq_wa_conversations` já tem `unread_count` e `last_read_at` — só precisa exibir e zerar.

- `ConversationList.tsx`: mostrar badge dourado com `unread_count` à direita do contato quando `> 0`; deixar nome em negrito e mover a conversa para o topo.
- `ChatView.tsx`: ao abrir uma conversa, chamar update `unread_count = 0, last_read_at = now()` (RPC ou update direto).
- Webhook `whatsapp-api` (mensagens recebidas): garantir incremento de `unread_count` em mensagens inbound (verificar — pode já existir).

### 2. Editar mensagem enviada
WhatsApp Evolution API suporta edição via endpoint `/chat/updateMessage/{instance}` com `{ number, key, text }` em até ~15min.

- Botão "Editar" no hover do balão (só para `direction = 'outbound'` e `created_at` < 15min).
- Dialog inline com textarea pré-preenchido.
- Nova Edge Function `whatsapp-edit-message` (ou ação no proxy `whatsapp-api` existente) que chama Evolution e atualiza `content` + `metadata.edited_at` na linha de `imphq_wa_messages`.
- Render do balão: se `metadata.edited_at` existir, mostrar "(editada)" em itálico abaixo.

### 3. Sistema de tags por contato
Nova tabela `imphq_wa_contact_tags`:

```text
id uuid pk
project_id text
phone text
tag text
color text
created_by uuid
created_at timestamptz
unique(project_id, phone, tag)
```

Com GRANTs + RLS por `project_id` do dono.

- Painel direito do `ChatView`: seção "Tags" com chips coloridos + input "Adicionar tag" (autocomplete das tags já usadas no projeto).
- Na `ConversationList`, mostrar as tags como mini-chips abaixo do nome.
- Filtro no topo da lista por tag (multi-select).

### Arquivos afetados
- `src/components/whatsapp/ConversationList.tsx` (badge, negrito, chips, filtro)
- `src/components/whatsapp/ChatView.tsx` (zerar unread, botão editar, painel tags)
- `supabase/functions/whatsapp-edit-message/index.ts` (novo) ou ação em `whatsapp-api`
- Migration: tabela `imphq_wa_contact_tags` + GRANTs + RLS

Confirma que posso seguir com esse plano?

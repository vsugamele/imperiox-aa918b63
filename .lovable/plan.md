## Objetivo
Ver claramente o que é mensagem nova no WhatsApp e ter as conversas mais recentes sempre no topo.

## Mudanças

### 1. Banco (migration)
Adicionar em `imphq_wa_conversations`:
- `unread_count int default 0`
- `last_read_at timestamptz`
- `last_message_direction text` (in/out)

Trigger em `imphq_wa_messages` (AFTER INSERT):
- Atualiza `last_message`, `last_message_at`, `last_message_direction` na conversa.
- Se `direction='in'` → `unread_count = unread_count + 1`.
- Se `direction='out'` → não mexe no unread (mensagem nossa não conta).

### 2. Listagem (`WhatsAppPage.tsx` + `ConversationList.tsx`)
- Ordenar por `last_message_at desc nulls last` (mais recentes no topo, inclusive após chegar mensagem nova via realtime).
- Passar `unread_count` e `last_message_direction` para a lista.
- Realtime: ao receber INSERT em `imphq_wa_messages`, mover a conversa para o topo e incrementar badge localmente (sem esperar refetch).

### 3. Visual da lista
Para conversas com `unread_count > 0`:
- Nome do contato em **negrito** + cor `text-foreground`.
- Última mensagem em `text-foreground` (em vez de `text-muted-foreground`).
- Badge verde (`bg-emerald-500 text-white`) com o número, substituindo o badge atual de `message_count`.
- Ponto verde pulsante ao lado do horário.
- Borda lateral esquerda sutil (`border-l-2 border-emerald-500`).

Para lidas: estilo atual (muted).

### 4. Marcar como lida
Ao selecionar a conversa (`onSelect`):
- UPDATE `imphq_wa_conversations set unread_count=0, last_read_at=now() where id=...`.
- Atualizar estado local imediato.

### 5. Header / contador global
- Filtro "Não lidas" (toggle) no topo da lista.
- Contador "X não lidas" no rodapé ao lado de "Y conversa(s)".

## Fora de escopo
- Notificação sonora/push (já existe via NotificationBell).
- Marcar como não lida manualmente.

## Plano: tornar visível a separação de conversas por chip

### 1. Realtime de novas conversas
Em `src/pages/WhatsAppPage.tsx`, adicionar subscriber `INSERT` em `imphq_wa_conversations`:
- Quando o webhook criar uma nova conv (ex.: lead falando com outro chip), o registro é injetado no topo de `sessions` automaticamente.
- Refetch leve dos dados da conv (avatar, contact_name) já é coberto pelo efeito existente.

### 2. Realtime de mudança de provider
Adicionar também `UPDATE` em `imphq_wa_conversations` filtrando por `provider_id` — se uma conv mudar de chip (caso futuro), a UI reflete sem reload.

### 3. Indicador visual quando a conversa selecionada não pertence ao chip filtrado
Pequeno aviso no header da `ChatView`: "Esta conversa é do chip X" quando `selectedSession.provider_id !== filterProvider`. Ajuda a evitar respondê-la pelo chip errado.

### Fora de escopo
- Mesclar/migrar conversas antigas de um chip para outro.
- Mudar lógica de envio (já usa `selectedSession.provider_id` corretamente).

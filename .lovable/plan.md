## Plano — Corrigir duplicate key em `imphq_wa_conversations`

A constraint é `UNIQUE(project_id, phone)`. Há múltiplos `INSERT` que correm em paralelo (webhook + sync_contacts + history_import + criação manual) usando padrão "select → insert" sem proteção contra race condition, então duas execuções simultâneas inserem o mesmo (project_id, phone) e a segunda quebra.

### Mudanças

1. **`supabase/functions/whatsapp-api/index.ts`** — trocar todos os `.insert(...)` de conversas por `.upsert(..., { onConflict: 'project_id,phone', ignoreDuplicates: false }).select().single()`:
   - `findOrCreateConversation` (linha 74)
   - `sync_contacts` batch insert (linha 689) → upsert com `onConflict: 'project_id,phone', ignoreDuplicates: true`
   - `history_import` insert (linha 1447) → upsert + re-select por (project_id, phone) se vier nulo

2. **`src/pages/WhatsAppPage.tsx`** (linha 162) — `createSession`: trocar `.insert` por `.upsert(..., { onConflict: 'project_id,phone' })` e mostrar toast "Conversa já existia, reaproveitada" quando aplicável (detectar via `select().single()`).

### Detalhes técnicos
- `upsert` com `onConflict` exige que a constraint composta exista (já existe: `imphq_wa_conversations_project_id_phone_key`).
- Para `sync_contacts` e `history_import` (em lote), `ignoreDuplicates: true` evita falha sem precisar tratar erro.
- Para criação manual e `findOrCreateConversation`, manter `ignoreDuplicates: false` para receber a linha (nova ou existente).
- Sem migração SQL — só código de aplicação.

### Fora de escopo
- Mudanças na lógica de mensagens, providers ou UI além do toast.
- Refatoração do webhook ou cache.
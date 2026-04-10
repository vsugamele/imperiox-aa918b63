

# Fix: Mensagens de entrada não são processadas

## Causa raiz

A Edge Function `whatsapp-api` tem dois bugs no handler de webhook que fazem **todas as mensagens de entrada caírem no "Unhandled"**:

1. **`providerType` contém lixo** — o valor vem como `evolution/contacts-update` em vez de `evolution`. O check `providerType === "evolution"` (linha 496) falha.

2. **`eventType` em formato errado** — Evolution envia `messages.upsert` (minúsculo, com pontos) mas o código compara com `MESSAGES_UPSERT` (maiúsculo, underscores). Idem para `messages.update`, `connection.update`, etc.

## Solução

Adicionar normalização no início do handler de webhook (ação `webhook`, após linha 490):

```typescript
// Normalize providerType — extract just "evolution" or "twilio"
const rawProvider = url.searchParams.get("provider") || "evolution";
const providerType = rawProvider.split("/")[0].toLowerCase();

// Normalize eventType — map "messages.upsert" → "MESSAGES_UPSERT"
const rawEventType = evolutionEventFromPath || body?.event || "MESSAGES_UPSERT";
const eventType = rawEventType.toUpperCase().replace(/[.\-]/g, "_");
```

Isso faz `messages.upsert` → `MESSAGES_UPSERT`, `connection.update` → `CONNECTION_UPDATE`, e `evolution/contacts-update` → `evolution`.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | Normalizar `providerType` e `eventType` no webhook handler (~4 linhas) |

## Resultado
Mensagens inbound voltam a ser processadas e salvas no banco. O chat vai receber as mensagens corretamente.


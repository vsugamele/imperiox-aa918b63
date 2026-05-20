## Problema

A conversa `259441828044831` foi criada **antes** da feature de `@lid` (com `jid_suffix='s.whatsapp.net'`). Como o usuário não recebeu nenhuma mensagem nova desde a migração, o webhook nunca rodou para corrigir o sufixo — então o `send_message` continua tentando validar como E.164 e falha com "DDI desconhecido".

## Solução: fallback automático para `@lid`

Em `supabase/functions/whatsapp-api/index.ts`, no bloco `send_message` (linhas 308–319):

Quando `jidSuffix === 's.whatsapp.net'` **e** `normalizePhone` falhar, em vez de retornar erro imediatamente, aplicar heurística de `@lid`:

- Se os dígitos têm comprimento ≥ 13 (IDs `@lid` típicos têm 15) e nenhum DDI conhecido bate, assumir que é `@lid`.
- Setar `phone = <digits>@lid`, `detectedCC = 'lid'`.
- Fazer **UPDATE** em `imphq_wa_conversations` setando `jid_suffix='lid'` para a `conversation_id`, para corrigir o registro retroativamente.
- Prosseguir com o envio normal.

Se a heurística não bater (ex: 9 dígitos sem DDI válido), aí sim retornar o erro original.

## Backfill opcional (uma migração)

Atualizar registros antigos que claramente são `@lid`:

```sql
UPDATE imphq_wa_conversations
SET jid_suffix = 'lid'
WHERE jid_suffix = 's.whatsapp.net'
  AND length(phone) >= 13
  AND phone !~ '^(55|1|7|33|34|44|49|351|352|353|354|...)';
```

Mas como a heurística no `send_message` já corrige sob demanda, a migração é opcional.

## Escopo

- 1 arquivo: `supabase/functions/whatsapp-api/index.ts` (~15 linhas no bloco `send_message`)
- Sem mudanças em UI

Confirma que sigo?
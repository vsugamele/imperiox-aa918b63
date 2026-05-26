## Problema

Na sidebar de Conversas, todas as linhas parecem iguais — é impossível bater o olho e saber quais ainda não foram lidas. O visual de "não lida" (negrito + barra verde à esquerda + badge verde com contador) **já existe no código**, mas nunca aparece, porque `unread_count` quase nunca é incrementado:

1. **Webhook não conta**: quando chega mensagem do lead, o servidor grava `last_message_at` mas **não incrementa `unread_count`**. Então conversas antigas/históricas ficam todas em 0.
2. **Realtime só funciona com a aba aberta**: o incremento client-side roda em `WhatsAppPage.tsx`, mas compara `m.direction === "in"` enquanto o banco grava `"incoming"` — ou seja, **nem com a aba aberta o contador sobe**.
3. **Sem fallback visual**: se `unread_count = 0`, não há nada secundário (ex.: comparar `last_read_at` vs `last_message_at`) pra marcar como não lida.

Resultado: o usuário vê 148 conversas e não sabe qual chegou agora.

## O que vai mudar

### 1. Servidor — webhook incrementa unread_count (fonte da verdade)
`supabase/functions/whatsapp-api/index.ts` → `updateConversationAfterMessage()` ganha um parâmetro `incrementUnread: boolean`. Nas 3 chamadas de mensagem **entrante** (linhas 462, 588, 1055) passa `true`; nas chamadas de resposta do bot (1138, 1480) passa `false`. Quando `true`, o update vira:
```ts
unread_count: (currentUnread || 0) + 1,
last_message_direction: 'incoming',
```
Busca o `unread_count` atual junto com `message_count` antes de atualizar.

### 2. Cliente — corrigir bug do realtime
`src/pages/WhatsAppPage.tsx` linha 103: aceitar tanto `"in"` quanto `"incoming"`:
```ts
const isInbound = m.direction === "in" || m.direction === "incoming";
```

### 3. Cliente — fallback derivado pra mensagens antigas
`src/components/whatsapp/ConversationList.tsx`: tratar como não lida sempre que:
- `unread_count > 0`, **ou**
- `last_message_direction` é `"incoming"`/`"in"` **e** (`last_read_at` é nulo **ou** `last_read_at < last_message_at`).

Isso resolve o backlog (mensagens que chegaram antes do fix do servidor já aparecem como não lidas).

### 4. Cliente — destaque visual mais forte
Hoje o "não lida" é sutil demais (borda verde de 2px + fundo 4% de opacidade). Subir o sinal:
- Fundo da linha não lida: `bg-emerald-500/10` (era `0.04`)
- Borda esquerda: `border-l-4` (era `border-l-2`) e cor `border-l-emerald-400`
- **Bolinha verde** ao lado do avatar quando não lido (ponto de 8px, animado com pulse leve), além do badge numérico
- Nome em `font-bold text-emerald-50` quando não lido (hoje só `font-bold`)
- Preview da última mensagem em `text-foreground` (em vez de `text-muted-foreground`) quando não lida

### 5. Cliente — ordenação prioriza não lidas
Em `ConversationList.tsx`, no `sort` adicionar critério primário: não lidas vêm antes; dentro de cada grupo continua ordenando por data desc. Assim o que precisa de atenção fica sempre no topo da lista visível.

### 6. Cliente — badge "X novas" no header já existe, mas refletindo o fallback
`totalUnread` passa a contar pelo mesmo critério derivado do item 3 (não só `unread_count`).

## Arquivos tocados

- `supabase/functions/whatsapp-api/index.ts` (helper + 3 call sites de inbound)
- `src/pages/WhatsAppPage.tsx` (fix do filtro `in`/`incoming`)
- `src/components/whatsapp/ConversationList.tsx` (fallback derivado, visual mais forte, sort por não lida, totalUnread)

Sem migração de banco — `unread_count` e `last_read_at` já existem na tabela.

## Resultado esperado

Bater o olho na sidebar e ver imediatamente: barra verde grossa + fundo esverdeado + bolinha pulsando + nome em branco forte + número de mensagens novas, e essas conversas ficam no topo. Mensagens novas que cheguem com a aba fechada também contam (servidor). Backlog histórico aparece como não lido enquanto o `last_read_at` não for atualizado.

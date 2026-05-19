## Diagnóstico

Confirmei pelo banco que as respostas da IA **estão sim sendo salvas em `imphq_wa_messages`** com `direction: outgoing`, `status: sent`. Não é bug de persistência.

O que está acontecendo:

1. O lead que mandou "oi" (`5511976546714`, contato "Vini") está na conversa `92b89bfd…` que pertence à instância **jpfreitas** (projeto `jp_freitas`).
2. Na tela que você tirou screenshot, o filtro de instância está em **Suporte Oficial (72)** — então a conversa do jpfreitas simplesmente não aparece na lista da esquerda.
3. Resultado: as respostas existem, mas estão escondidas pelo filtro.

Para confirmar agora: clique no filtro **jpfreitas (46)** (ou em **Todos (118)**) e abra a conversa do "Vini" / `5511976546714`. Você vai ver as respostas da IA lá.

## Problema secundário descoberto

Para cada resposta `outgoing` da IA, existe uma cópia `incoming` com o mesmo conteúdo gravada ~200ms depois (ex.: 21:37:19.988 outgoing + 21:37:20.196 incoming, mesmo texto). Há um filtro `key.fromMe` no webhook (linha 734) mas algo está furando — provavelmente quando a Evolution reentrega o evento com `fromMe` em outro envelope, ou via outro caminho (`SEND_MESSAGE` / `messages.update`).

Isso polui a timeline e pode estar realimentando a IA (ela "vê" sua própria mensagem como se fosse do lead → loop, exatamente o sintoma da imagem com IA pedindo desculpa por estar em loop).

## Plano de correção

### A. UI — não esconder conversas com atividade recente
- Em `ConversationList`, quando uma conversa receber/enviar mensagem nas últimas 24h, mostrar um badge "novo" no chip da instância que está oculta, ou ao menos um aviso "X conversas em outras instâncias com atividade".
- Persistir o último filtro escolhido (já existe localStorage em outros lugares) e mostrar contagem de não-lidas por filtro.

### B. Backend — blindar contra eco / fromMe
Em `supabase/functions/whatsapp-api/index.ts`:
1. Expandir o filtro fromMe no início do `MESSAGES_UPSERT` para também olhar:
   - `body?.data?.key?.fromMe`
   - `body?.data?.fromMe`
   - `body?.sender === provider.instance_name`
   - participante igual ao número da instância
2. Antes de inserir qualquer mensagem `incoming`, fazer dedupe via `provider_message_id` (já existe índice único — só checar o erro 23505 silenciosamente) **e** dedupe por janela curta: se já existe uma `outgoing` com o mesmo `content` nos últimos 10s na mesma `conversation_id`, descartar (é eco).
3. No bloco da IA autorresponder, ignorar mensagens cuja origem seja eco (mesmo critério acima) antes de chamar o Gemini — corta o loop na raiz.

### C. Verificação
- Após deploy, mandar novamente "oi" do número de teste e conferir no banco:
  - 1 linha `incoming` com "oi"
  - 1 linha `outgoing` com a resposta da IA
  - **zero** duplicatas `incoming` da resposta
- E conferir que a conversa aparece na ferramenta sem precisar trocar filtro (badge cross-instância).

## Fora de escopo
- Mudar persona/tom da IA.
- Reescrever o pipeline de webhook.
- Tocar em `ChatView` polling (já funciona; a mensagem chega em até 8s).

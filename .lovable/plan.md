## Problemas identificados

**1. IA disparou várias mensagens longas seguidas no "OI"**  
No `whatsapp-api/index.ts` (linhas 925-1090), cada `MESSAGES_UPSERT` dispara uma chamada Gemini independente. Se o lead manda 3 mensagens rápidas ("Oi", "tudo bem?", "queria saber..."), o webhook roda 3 vezes em paralelo e a IA responde 3 vezes — daí a sensação de "looping". Além disso não há trava nem debounce.

**2. Resposta da IA não apareceu no painel do app**  
O código insere em `imphq_wa_messages` (linha 1066), mas não há refresh em tempo real garantido na UI, e se o `conversation_id` foi recriado por race condition (lead novo + 2 webhooks simultâneos = duplicate key, que já vimos antes), o INSERT da resposta pode estar caindo em conversa órfã. Também falta `updated_at` para reordenar a lista.

---

## Plano

### A. Debounce + trava anti-loop (backend)

Em `supabase/functions/whatsapp-api/index.ts`, no bloco "AI Autoresponder":

1. **Trava por conversa (10s)**: antes de chamar Gemini, fazer `UPDATE imphq_wa_conversations SET ai_lock_until = now() + interval '10 seconds' WHERE id = conv.id AND (ai_lock_until IS NULL OR ai_lock_until < now()) RETURNING id`. Se não retornar linha, outro webhook já está respondendo → `return`.

2. **Debounce de 6s**: após pegar a trava, dormir 6s e então buscar a ÚLTIMA mensagem da conversa. Se a última `incoming` for mais nova que `content` atual, abortar (outra mensagem chegou depois — a próxima execução cuidará). Isso agrupa rajadas.

3. **Cooldown pós-resposta**: depois de responder, setar `ai_last_reply_at = now()`. Se nova msg chegar em <15s, IA fica em silêncio (o lead ainda está digitando reação).

4. **Migração**: adicionar colunas `ai_lock_until timestamptz` e `ai_last_reply_at timestamptz` em `imphq_wa_conversations`.

### B. Garantir que aparece no chat do app

5. No INSERT da resposta da IA, incluir `created_at: new Date().toISOString()` explícito e fazer `UPDATE imphq_wa_conversations SET last_message = aiReply, last_message_at = now(), updated_at = now() WHERE id = conv.id` (já existe via `updateConversationAfterMessage` — verificar se está mexendo em `last_message_at`).

6. Em `src/components/whatsapp/ChatView.tsx` (e `ConversationList`), garantir Realtime subscription em `imphq_wa_messages` filtrado por `conversation_id`, ou polling de 10s na conversa aberta. Se já existe, validar que está ativo na rota atual.

7. **Diagnóstico extra**: rodar uma query nos logs do webhook (últimas 24h) buscando `"AI auto-reply sent"` e cruzar com `imphq_wa_messages` para confirmar se o INSERT realmente persistiu nos casos da imagem.

### C. UX no painel de configuração da IA

8. Em `WhatsAppAIConfig.tsx`, expor sliders novos:
   - "Aguardar resposta do lead (debounce)" — 3 a 15s, default 6s
   - "Cooldown após responder" — 0 a 60s, default 15s
   - Tooltip explicando que evita "looping" e múltiplas respostas seguidas.

---

## Fora de escopo
- Mudar tom/persona da IA (resposta longa no print é configuração de `max_tokens` + tom, ajustável depois).
- Reescrever o pipeline de webhook ou trocar Gemini.
- Bug do "system entered a loop" (autoreferência) — virá naturalmente quando a trava A1 impedir as 3 respostas seguidas.

## Detalhes técnicos
- Trava usa `UPDATE ... WHERE ai_lock_until < now() RETURNING` como CAS atômico (Postgres garante).
- Debounce dentro do edge function via `setTimeout` + re-query — seguro porque webhook tem 150s de budget e usamos 6-10s.
- Não precisa fila externa (Redis/pg_cron) — escala suficiente para volume atual.
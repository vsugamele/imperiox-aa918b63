# WA1.1 — Bot do WhatsApp não respondia mensagens fora do horário

**Status:** Done (07/10/2026)

## Sintoma
"O bot do WhatsApp não está respondendo." Nas últimas 24 h havia 134 mensagens de leads e poucas respostas.

## Diagnóstico
- 105 das 134 mensagens eram de **grupos** (o bot não responde grupo, de propósito) e 6 de uma conversa com a IA desligada à mão. Das 7 conversas individuais elegíveis, 5 foram respondidas.
- O bot do JP usa a config ligada ao número (`imphq_wa_ai_config` b50d3358…, horário comercial **08:00–20:00** BRT, editada em 07/07). Há também uma config antiga do projeto (sem horário comercial, até 22:00) que só vale como reserva.
- Fora do horário o `wa-ai-reply` enfileira (`ai_pending_since`) e o `wa-ai-pending-flush` (cron a cada 10 min) deveria responder quando o horário abre.
- **Defeito:** o flush lia a última mensagem pedindo a coluna `message_id`, que não existe em `imphq_wa_messages` (o nome é `provider_message_id`). A consulta falhava, caía em "no_message" e **limpava a fila sem responder**. Toda mensagem depois das 20h ficava sem resposta. O código estava assim desde 25/06.
- Impacto medido (14 dias): 4 conversas do JP ainda sem resposta com a última mensagem recebida à noite (04/10 20:07, 05/10 21:25, 06/10 21:12 e 23:13).

## Correção
- [x] `wa-ai-pending-flush` lê `provider_message_id`; erro de leitura não apaga mais a fila (mantém o pending e tenta na próxima rodada).
- [x] Versão no ar conferida igual ao HEAD antes de publicar; publicada com a fila vazia (nenhuma mensagem disparada na publicação).
- [x] Busca nas outras functions por leitura de `imphq_wa_messages` pedindo `message_id`: nenhuma outra.
- [ ] Conferir na primeira manhã (08:00 BRT) que conversas enfileiradas à noite foram respondidas (`action: invoked` no log do flush e mensagem `ai` na conversa).
- [ ] Decisão do Vinicius: responder agora as 4 conversas que ficaram sem resposta?

## File List
- `supabase/functions/wa-ai-pending-flush/index.ts`

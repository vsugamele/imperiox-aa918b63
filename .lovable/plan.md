## Diagnóstico

Nenhum áudio inbound tem `transcript` desde **02/07** (12 áudios só hoje, 0 transcritos). Nada de "ElevenLabs Scribe" nos logs de `wa-ai-reply`.

Causa raiz: a transcrição vive dentro da função `wa-ai-reply` (autoresponder). Ela só roda se essa função for invocada e chegar até o bloco de STT. Hoje, para os áudios do jp_freitas:

1. Webhook agenda `wa-ai-reply` com **debounce de 8s**. Cada nova mensagem sobrescreve `ai_debounce_until` e o scheduled anterior "cede turno". Nos logs, todos os scheduleds das últimas horas terminaram em `superado por trigger mais recente` — `wa-ai-reply` **nunca foi invocado**, então nunca transcreveu.
2. Mesmo quando é invocado, a conversa em questão tem `ai_paused_until` até 23:17 (humano assumiu no inbox). Áudio novo chega, IA continua pausada, e como todo o pipeline de STT está *dentro* dessa função, nada é transcrito nem gravado.

Resumindo: **transcrição está acoplada à decisão de responder**. Se a IA não vai responder (pausa por humano, debounce vencido, handoff), o áudio fica sem texto para sempre — no inbox aparece só "🎤 Áudio (Xs)".

## Correção proposta

Separar transcrição em uma edge function própria — `wa-audio-transcribe` — invocada pelo webhook sempre que um áudio inbound é salvo, independente do autoresponder.

### Backend

1. Nova edge `wa-audio-transcribe`:
   - Recebe `{ message_id, media_url, project_id, conversation_id, lead_id? }`
   - Baixa o `.ogg` do bucket `whatsapp-media`
   - Chama ElevenLabs Scribe v2 (mesmo código de hoje em `wa-ai-reply`)
   - `UPDATE imphq_wa_messages SET transcript = ... WHERE id = message_id`
   - Se `lead_id` + `project_id`, também gera embedding e insere em `imphq_wa_lead_memory` (mantém comportamento atual)
   - Guarda erro em `transcript = null` e loga; não retenta em loop

2. `whatsapp-api/_lib/webhook-handler.ts`:
   - Após `insert` bem-sucedido de mensagem `messageType === "audio"` com `mediaUrl`, disparar fire-and-forget `supabase.functions.invoke("wa-audio-transcribe", { body: { message_id, media_url, project_id, conversation_id, lead_id } })`
   - **Independente** do bloco de autoresponder / matched / ai_paused_until

3. `wa-ai-reply/index.ts`:
   - Manter o bloco atual como *fallback* (se `body.media_url` chegou e a mensagem no DB ainda não tem transcript, tenta transcrever)
   - Antes de chamar Scribe, ler `imphq_wa_messages` e reutilizar `transcript` já salvo → evita chamar ElevenLabs duas vezes e evita cobrar de novo

### Frontend

Sem mudanças na tela agora. O chat já lê `transcript` quando existe (comportamento atual segue). Depois podemos adicionar botão "Transcrever novamente" no áudio para casos em que o STT falhou.

### Backfill (opcional, mesmo PR)

Botão discreto no áudio ("Transcrever") que invoca a nova função para uma mensagem específica — permite recuperar os áudios de 02–09/07 que ficaram sem texto sem rodar um job em massa.

## Detalhes técnicos

- Secret `ELEVENLABS_API_KEY` já existe (foi usado até 01/07). Confirmar antes de deploy.
- `wa-audio-transcribe` roda com `verify_jwt = false` (default) e valida token de serviço via `SUPABASE_SERVICE_ROLE_KEY` no header, como as outras internas.
- Idempotência: função checa se `transcript IS NOT NULL` antes de chamar Scribe.
- Custo: 1 chamada Scribe por áudio inbound (mesmo custo do modelo antigo, só sem depender da decisão de responder).

## Fora do escopo

- Ajustar a lógica do debounce de `wa-ai-reply` (bug secundário — separaria em PR próprio).
- Continuar o plano do OpenFlow — retomamos depois desta correção.



# Plano: Melhorar o Webhook Handler da Evolution API

## Problemas identificados

1. **"Webhook by Events" habilitado**: A Evolution API adiciona o nome do evento ao final da URL (ex: `.../whatsapp-api/MESSAGES_UPSERT?action=webhook&provider=evolution`). Isso pode impedir que o `action` seja reconhecido corretamente, pois a Edge Function pode interpretar o path de forma diferente.

2. **Só captura texto**: O handler ignora mensagens de imagem, áudio, vídeo, documentos e stickers — qualquer mídia recebida é silenciosamente descartada.

3. **Sem logging**: Não há log do que chega via webhook, dificultando debug. Se algo falha, não há como saber o que foi recebido.

4. **Ignora eventos de status**: A Evolution envia `MESSAGES_UPDATE` com status de entrega (delivered, read), mas o handler não processa — os status das mensagens enviadas nunca atualizam.

5. **Ignora eventos de conexão**: `CONNECTION_UPDATE` não é tratado — o status da sessão no banco fica desatualizado.

---

## Mudanças

### 1. Tornar o handler resiliente ao "Webhook by Events"
Atualmente o handler depende de `action === "webhook"`. Com "Webhook by Events" ativo, a Evolution envia para URLs como `/whatsapp-api/MESSAGES_UPSERT`. Preciso detectar quando o path contém um nome de evento da Evolution e tratar como webhook, independente do query param `action`.

### 2. Capturar tipos de mídia
Extrair conteúdo de `imageMessage`, `audioMessage`, `videoMessage`, `documentMessage`, `stickerMessage` e salvar com um indicador de tipo (ex: `[📷 Imagem]`, `[🎤 Áudio]`).

### 3. Adicionar logging estruturado
Logar evento recebido, tipo, instância e resultado do processamento para facilitar debug via `edge_function_logs`.

### 4. Processar MESSAGES_UPDATE (status de entrega)
Quando receber evento de status update (`delivered`, `read`, `played`), atualizar o campo `status` da mensagem correspondente em `imphq_wa_messages` usando o `provider_message_id`.

### 5. Processar CONNECTION_UPDATE
Atualizar o `status` da sessão em `imphq_wa_providers` ou `imphq_wa_conversations` quando a conexão mudar (open/close/connecting).

---

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | Refatorar bloco webhook (linhas 472-526) com detecção de evento por path, suporte a mídia, status updates e logging |

## Resultado
Mensagens recebidas via WhatsApp (texto e mídia) aparecerão automaticamente no chat. Status de entrega/leitura serão atualizados em tempo real. Debugging facilitado com logs estruturados.

